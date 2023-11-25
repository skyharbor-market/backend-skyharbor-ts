import { testserver, runMigrations, cleanUp, truncateTables } from '../helpers'
import { testPool, testApiKeysPool } from '../pools'
import { apiKeyPool } from '../../src/middlewares/rateLimiterPg'
import { siteApiPool, ergoPayPool } from '../../src/server'
import supertest from "supertest"
import { getApiKeyByUser, getTokenPlanLimits, ApiKey } from '../../src/api/utils/db'

describe('API Keys routes', () => {
  // TODO: create mock stripe endpoint

  beforeAll(async () => {
    const m = await runMigrations()
    expect(m).toBe("everything is setup")
  })

  // it('placeholder', () => {
  //   expect(true)
  // })

  it('Generate free tier API token', async () => {
    await supertest(testserver)
      .post('/api/keys/generate')
      .set('Content-Type', 'application/json')
      .send({ user: "test-user-free" })
      .expect(200)
      .expect((res) => {
        expect(res.body.api_key).toBeDefined()
      })
  })

  it('Fail with missing user', async () => {
    await supertest(testserver)
      .post('/api/keys/generate')
      .set('Content-Type', 'application/json')
      .send({ user: "test-user-missing" })
      .expect(500)
      .expect((res) => {
        expect(res.body.api_key).toBeUndefined()
      })
  })

  it('Test missing api_key header', async () => {
    await supertest(testserver)
      .get('/api/v1/sales/test')
      .send()
      .expect(400)
  })

  it('Test increment of key limits of both sales and txs apis', async () => {
    let apiKey: string = ""
    let user: string = "test-user-free"

    await supertest(testserver)
      .post('/api/keys/generate')
      .set('Content-Type', 'application/json')
      .send({ user: user })
      .expect(200)
      .expect((res) => {
        expect(res.body.api_key).toBeDefined()
        apiKey = res.body.api_key
      })

    // get API key hash so we can get the token limits
    const hash = await getApiKeyByUser(user)
    expect(hash).toBeDefined()
    // get limits before token usage
    const beforeLimits = await getTokenPlanLimits(hash!.hash)
    expect(beforeLimits).toBeDefined()

    // use token for sales and tx
    await supertest(testserver)
      .get('/api/v1/sales/test')
      .set('api_key', apiKey)
      .send()
      .expect(200)

    await supertest(testserver)
      .get('/api/v1/txs/test')
      .set('api_key', apiKey)
      .send()
      .expect(200)

    const afterLimits = await getTokenPlanLimits(hash!.hash)
    expect(afterLimits).toBeDefined()
    // check that sales and tx limits incremented by 1
    const beforeSalesIdx = beforeLimits!.find((val) => { if (val.key.indexOf("_sales:") != -1) return true })
    const beforeTxsIdx = beforeLimits!.find((val) => { if (val.key.indexOf("_txs:") != -1) return true })
    const afterSalesIdx = afterLimits!.find((val) => { if (val.key.indexOf("_sales:") != -1) return true })
    const afterTxsIdx = afterLimits!.find((val) => { if (val.key.indexOf("_txs:") != -1) return true })
    expect(afterSalesIdx!.points).toBe(beforeSalesIdx!.points + 1)
    expect(afterTxsIdx!.points).toBe(beforeTxsIdx!.points + 1)

  })

  it('Test retention of key limits with new API key generation (only for same tier plan)', async () => {
    let oldApiKey: string = ""
    let oldHash: ApiKey | undefined
    let newHash: ApiKey | undefined
    let user: string = "test-user-free"

    await supertest(testserver)
      .post('/api/keys/generate')
      .set('Content-Type', 'application/json')
      .send({ user: user })
      .expect(200)
      .expect((res) => {
        expect(res.body.api_key).toBeDefined()
        oldApiKey = res.body.api_key
      })

    // get API key hash so we can get the token limits
    oldHash = await getApiKeyByUser(user)
    expect(oldHash).toBeDefined()

    for (let index = 0; index < 2; index++) {
      // use token for sales and tx
      await supertest(testserver)
        .get('/api/v1/sales/test')
        .set('api_key', oldApiKey)
        .send()
        .expect(200)

      await supertest(testserver)
        .get('/api/v1/txs/test')
        .set('api_key', oldApiKey)
        .send()
        .expect(200)
    }
    // get limits before new key generation
    const beforeLimits = await getTokenPlanLimits(oldHash!.hash)
    expect(beforeLimits).toBeDefined()

    await supertest(testserver)
      .post('/api/keys/generate')
      .set('Content-Type', 'application/json')
      .send({ user: user })
      .expect(200)
      .expect((res) => {
        expect(res.body.api_key).toBeDefined()
      })

    newHash = await getApiKeyByUser(user)
    expect(newHash).toBeDefined()

    const afterLimits = await getTokenPlanLimits(newHash!.hash)
    expect(afterLimits).toBeDefined()
    // check that sales and tx limits are the same
    const beforeSalesIdx = beforeLimits!.find((val) => { if (val.key.indexOf("_sales:") != -1) return true })
    const beforeTxsIdx = beforeLimits!.find((val) => { if (val.key.indexOf("_txs:") != -1) return true })
    const afterSalesIdx = afterLimits!.find((val) => { if (val.key.indexOf("_sales:") != -1) return true })
    const afterTxsIdx = afterLimits!.find((val) => { if (val.key.indexOf("_txs:") != -1) return true })
    expect(afterSalesIdx!.points).toBe(beforeSalesIdx!.points)
    expect(afterTxsIdx!.points).toBe(beforeTxsIdx!.points)
  })

  it('Test rate limit for incorrect/invalid api key', async () => {
    for (let index = 0; index < 5; index++) {
      // for fast brute we allow 5 invalid tokens within 1 minute
      await supertest(testserver)
        .get('/api/v1/sales/test')
        .set('api_key', "badkey")
        .send()
        .expect(403)
    }

    await supertest(testserver)
      .get('/api/v1/sales/test')
      .set('api_key', "badkey")
      .send()
      .expect(429)
  })

  it('Test rate limit for free api key monthly limit', async () => {
    let apiKey: string = ""
    let user: string = "test-user-free"

    await supertest(testserver)
      .post('/api/keys/generate')
      .set('Content-Type', 'application/json')
      .send({ user: user })
      .expect(200)
      .expect((res) => {
        expect(res.body.api_key).toBeDefined()
        apiKey = res.body.api_key
      })

    for (let index = 0; index < 500; index++) {
      await supertest(testserver)
        .get('/api/v1/sales/test')
        .set('api_key', apiKey)
        .send()
        .expect(200)
    }

    await supertest(testserver)
      .get('/api/v1/sales/test')
      .set('api_key', apiKey)
      .send()
      .expect(429)

    for (let index = 0; index < 20; index++) {
      await supertest(testserver)
        .get('/api/v1/txs/test')
        .set('api_key', apiKey)
        .send()
        .expect(200)
    }

    await supertest(testserver)
      .get('/api/v1/txs/test')
      .set('api_key', apiKey)
      .send()
      .expect(429)
  })

  afterEach(async () => {
    const t = await truncateTables()
    expect(t).toBe("truncate done")
  })

  afterAll(async () => {
    await siteApiPool.end()
    await ergoPayPool.end()
    await testApiKeysPool.end()
    await apiKeyPool.end()
    const c = await cleanUp()
    expect(c).toBe("clean up done")
    await testPool.end()
    testserver.close(async () => {
      // process.exit(0)
    })
  })
})
