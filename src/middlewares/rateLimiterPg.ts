import { RateLimiterPostgres } from 'rate-limiter-flexible'
import { Request, Response, NextFunction } from 'express'
import { apiKeyUser, apiKeyUserPass } from '../consts/users'
import { testApiKeysPool } from '../../tests/pools'
import { blake2s } from '@noble/hashes/blake2s'
import { Pool } from 'pg'
import { getApiKeyByPrefix, ApiKey, DBError } from '../api/utils/db'

const aKeyPool = new Pool({
  host: "localhost",
  port: 5432,
  database: "apikeys",
  user: apiKeyUser,
  password: apiKeyUserPass,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
  max: 50,
})

export const apiKeyPool = aKeyPool

// use test pool if this is a test env
const pool = process.env.NODE_ENV !== 'test' ? aKeyPool : testApiKeysPool

// TODO?: Move these tier values to DB
export const apiTiers = {
  free: {
    sales: {
      storeClient: pool,
      points: 500, // Number of calls
      duration: 2678400, // 31 days in seconds

      tableName: 'key_limits',
      keyPrefix: 'free_sales',
      tableCreated: true,
    },
    txs: {
      storeClient: pool,
      points: 20, // Number of calls
      duration: 2678400, // 31 days in seconds

      tableName: 'key_limits',
      keyPrefix: 'free_txs',
      tableCreated: true,
    },
  },
  small: {
    sales: {
      storeClient: pool,
      points: 10000, // Number of calls
      duration: 2678400, // 31 days in seconds

      tableName: 'key_limits',
      keyPrefix: 'small_sales',
      tableCreated: true,
    },
    txs: {
      storeClient: pool,
      points: 350, // Number of calls
      duration: 2678400, // 31 days in seconds

      tableName: 'key_limits',
      keyPrefix: 'small_txs',
      tableCreated: true,
    },
  },
  medium: {
    sales: {
      storeClient: pool,
      points: 100000, // Number of calls
      duration: 2678400, // 31 days in seconds

      tableName: 'key_limits',
      keyPrefix: 'medium_sales',
      tableCreated: true,
    },
    txs: {
      storeClient: pool,
      points: 1500, // Number of calls
      duration: 2678400, // 31 days in seconds

      tableName: 'key_limits',
      keyPrefix: 'medium_txs',
      tableCreated: true,
    },
  },
  large: {
    sales: {
      storeClient: pool,
      points: 1000000, // Number of calls
      duration: 2678400, // 31 days in seconds

      tableName: 'key_limits',
      keyPrefix: 'large_sales',
      tableCreated: true,
    },
    txs: {
      storeClient: pool,
      points: 10000, // Number of calls
      duration: 2678400, // 31 days in seconds

      tableName: 'key_limits',
      keyPrefix: 'large_txs',
      tableCreated: true,
    },
  },
}

const rateLimiterPgFreeSales = new RateLimiterPostgres(apiTiers.free.sales)
const rateLimiterPgFreeTxs = new RateLimiterPostgres(apiTiers.free.txs)
const rateLimiterPgSmallSales = new RateLimiterPostgres(apiTiers.small.sales)
const rateLimiterPgSmallTxs = new RateLimiterPostgres(apiTiers.small.txs)
const rateLimiterPgMediumSales = new RateLimiterPostgres(apiTiers.medium.sales)
const rateLimiterPgMediumTxs = new RateLimiterPostgres(apiTiers.medium.txs)
const rateLimiterPgLargeSales = new RateLimiterPostgres(apiTiers.large.sales)
const rateLimiterPgLargeTxs = new RateLimiterPostgres(apiTiers.large.txs)

// protect against brute force and DDOS attacks
const rateLimiterPgFastBruteByIP = new RateLimiterPostgres({
  storeClient: pool,
  keyPrefix: 'bad_token_ip_per_min',
  tableName: 'key_limits',
  tableCreated: true,
  points: 5,
  duration: 60,
  blockDuration: 60 * 10, // Block for 10 minutes, if 5 wrong attempts per 1 minute
})

const rateLimiterPgSlowBruteByIP = new RateLimiterPostgres({
  storeClient: pool,
  keyPrefix: 'bad_token_ip_per_day',
  tableName: 'key_limits',
  tableCreated: true,
  points: 100,
  duration: 60 * 60 * 24,
  blockDuration: 60 * 60 * 24, // Block for 1 day, if 100 wrong attempts per day
})

async function checkApiKey(key: string): Promise<ApiKey | DBError> {

  // check if key is present in DB
  const pFix = key.substring(0, 8)

  // query db for key
  const apiKey: ApiKey | DBError = await getApiKeyByPrefix(pFix)

  if (apiKey instanceof DBError) {
    return apiKey
  }

  // validate key with salt
  const b2params = { salt: pFix, dkLen: 32 }
  const hash = blake2s(key, b2params)
  const decodedHash = Buffer.from(hash).toString('hex')
  if (apiKey.hash !== decodedHash) {
    return new DBError("api_key is not valid", 403)
  }

  // check if key is active
  if (apiKey.status !== "active") {
    return new DBError("api_key is not active", 403)
  }

  return apiKey
}

export const rateLimiterPgMiddleware = async (req: Request, res: Response, next: NextFunction) => {

  const key = req.get('api_key')
  const ipAddr = req.ip

  // check if api_key Header is present
  if (!key) {
    res.status(400).send({ "error": "missing api_key header" })
    return
  }

  // check if api_key is active
  const keyData = await checkApiKey(key)
  if (keyData instanceof DBError) {
    // check for too many concurrent bad requests from the same IP
    if (keyData.code === 403 && (keyData.message === "api_key is not found" || keyData.message === "api_key is not valid")) {
      const [resFast, resSlow] = await Promise.allSettled([
        rateLimiterPgFastBruteByIP.consume(ipAddr),
        rateLimiterPgSlowBruteByIP.consume(ipAddr),
      ])
      if (resSlow !== null && resSlow.status === "rejected") {
        res.set({ "Retry-After": resSlow.reason.msBeforeNext / 1000, })
        res.status(429).send({ "error": "Too Many Requests" })
        return
      } else if (resFast !== null && resFast.status === "rejected") {
        res.set({ "Retry-After": resFast.reason.msBeforeNext / 1000, })
        res.status(429).send({ "error": "Too Many Requests" })
        return
      }
    }
    res.status(keyData.code).send({ "error": keyData.message })
    return
  }

  // check plan associated with api_key and route path
  let planLimit
  let opts: any

  switch (req.baseUrl) {
    case '/api/v1/txs':
      switch (keyData.planTier) {
        case 'free':
          planLimit = rateLimiterPgFreeTxs
          opts = apiTiers.free.txs
          break
        case 'small':
          planLimit = rateLimiterPgSmallTxs
          opts = apiTiers.small.txs
          break
        case 'medium':
          planLimit = rateLimiterPgMediumTxs
          opts = apiTiers.medium.txs
          break
        case 'large':
          planLimit = rateLimiterPgLargeTxs
          opts = apiTiers.large.txs
          break
      }
      break
    case '/api/v1/sales':
      switch (keyData.planTier) {
        case 'free':
          planLimit = rateLimiterPgFreeSales
          opts = apiTiers.free.sales
          break
        case 'small':
          planLimit = rateLimiterPgSmallSales
          opts = apiTiers.small.sales
          break
        case 'medium':
          planLimit = rateLimiterPgMediumSales
          opts = apiTiers.medium.sales
          break
        case 'large':
          planLimit = rateLimiterPgLargeSales
          opts = apiTiers.large.sales
          break
      }
      break
  }

  if (planLimit !== undefined) {
    // pass planLimit and opts to the next function since we need more business logic to perform a consume
    res.locals.planLimit = planLimit
    res.locals.opts = opts
    res.locals.hash = keyData.hash
    next()

  } else {
    res.status(500).send({ "error": "rate limiters not working" })
  }
}