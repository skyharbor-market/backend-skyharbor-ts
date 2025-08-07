import { Pool, PoolClient, QueryResult, QueryConfig } from 'pg'
// import { testApiKeysPool } from '../../../tests/pools'
import { apiKeyPool } from '../../middlewares/rateLimiterPg'
import logger from '../../logger'

// TODO: rate limit api token generation? I don't trust people from spamming our API

export class KeyLimit {
  key: string
  points: number
  expire: number
  constructor(key: string, pts: number, expire: number) {
    this.key = key
    this.points = pts
    this.expire = expire
  }
}

export class ApiUser {
  id: number
  name: string
  walletAddr?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  constructor(id: number, name: string, walletAddr?: string, stripeCustomerId?: string, stripeSubscriptionId?: string) {
    this.id = id
    this.name = name
    this.walletAddr = walletAddr
    this.stripeCustomerId = stripeCustomerId
    this.stripeSubscriptionId = stripeSubscriptionId
  }
}

export class ApiKey {
  id: number
  hash: string
  prefix: string
  createTime: Date
  expireTime: Date
  lastUsedTime?: Date | null
  planTier: string
  user: string
  status: string
  constructor(id: number, hash: string, prefix: string, cTime: string, exTime: string, planTier: string, user: string, status: string, lastUsedTime?: string) {
    this.id = id
    this.hash = hash
    this.prefix = prefix
    this.createTime = new Date(cTime)
    this.expireTime = new Date(exTime)
    lastUsedTime != null ? this.lastUsedTime = new Date(lastUsedTime) : this.lastUsedTime = undefined
    this.planTier = planTier
    this.user = user
    this.status = status
  }
}

export class DBError {
  message: string
  code: number
  constructor(msg: string, code: number) {
    this.message = msg
    this.code = code
  }
}

export async function addSubscriptionTask(subId: string, task: string, runAt: number, priceId?: string) {
  const jobId = await globalThis.pgboss.sendAfter('subscription-tasks', { task: task, subscription_id: subId, price_id: priceId }, { singletonKey: subId + task, retryLimit: 3, retryDelay: 1000 }, new Date(runAt * 1000))
  if (typeof jobId === "string") {
    globalThis.queuedJobs.push(jobId)
    logger.info({
      message: "pg task scheduled",
      component: "backend-api",
      job_id: jobId,
      task: task
    })
  } else {
    logger.error({ message: "failed to schedule pg task", component: "backend-api" })
  }
}

export async function removeSubscriptionTask(subId: string) {
  const found = globalThis.queuedJobs.some(async (jobId, idx) => {
    const job: any = await globalThis.pgboss.getJobById(jobId)
    if (job?.data.subscription_id === subId) {
      await globalThis.pgboss.cancel(jobId)
      logger.info({ message: "scheduled task bas been cancelled", component: "backend-api", job_id: jobId, task: job.data.task })
      globalThis.queuedJobs.splice(idx, 1)
      return true
    }
  })
  if (!found) {
    logger.error({ message: "scheduled task not found", component: "backend-api", subscription_id: subId })
  }
}

export async function getQueuedJobs(queueName: string): Promise<string[] | undefined> {
  const jobs: string[] = []
  let dbResp: QueryResult<any> | undefined

  const dbQuery: QueryConfig<any[]> = {
    text: 'select id from pgboss.job where name = $1 and state = $2',
    values: [`${queueName}`, "created"]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error getting job ids from pgboss schema",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  if (dbResp.rowCount === 0) {
    return undefined
  }

  dbResp.rows.forEach(row => {
    jobs.push(row.id)
  })

  return jobs
}

export async function saveApiKey(hash: string, prefix: string, user: string, tier: string): Promise<boolean> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: `
      insert into keys (hash, prefix, "user", status, plan_tier, create_time, expire_time) values
        ($1, $2, $3, $4, $5, current_timestamp, current_timestamp + (2678400 * interval \'1 second\'))
      on conflict on constraint keys_user_key
      do update set
        hash = $1,
        prefix = $2,
        plan_tier = $5,
        create_time = current_timestamp,
        expire_time = current_timestamp + (2678400 * interval \'1 second\'),
        last_used_time = NULL
    `,
    values: [`${hash}`, `${prefix}`, `${user}`, "active", `${tier}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error inserting new api key into keys DB table",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return false
  }

  return true
}

export async function updateApiKeyWithUser(user: string, priceId: string) {
  const dbQuery: QueryConfig<any[]> = {
    text: `update keys k
           set plan_tier = name
           from plan_tiers pt
           where (k."user" = $1) and (pt.stripe_price_id = $2 or pt.stripe_price_id_test = $2)`,
    values: [`${user}`, `${priceId}`]
  }

  try {
    await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error updating plan_tier into keys DB table using user",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return
  }
}

export async function deleteApiKeyWithUser(user: string) {

}

export async function updateApiKeyWithSubscription(subId: string, priceId: string) {
  const dbQuery: QueryConfig<any[]> = {
    text: `update keys k
           set plan_tier = pt.name
           from plan_tiers pt, api_users u
           where (u.stripe_subscription_id = $1) and (k."user" = u.name) and (pt.stripe_price_id = $2 or pt.stripe_price_id_test = $2)`,
    values: [`${subId}`, `${priceId}`]
  }

  try {
    await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error updating plan_tier into keys DB table using subscription id",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return
  }
}

export async function updateApiUserWithCustomerAndSub(user: string, custId: string, subId: string) {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'update api_users set stripe_customer_id = $2, stripe_subscription_id = $3 where name = $1',
    values: [`${user}`, `${custId}`, `${subId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error updating stripe_customer_id and stripe_subscription_id into api_users DB table",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return
  }
}

export async function deactivateSubscriptionApiKey(subId: string) {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: `update keys k
           set plan_tier = $1
           from api_users u
           where u.stripe_subscription_id = $2 and k."user" = u.name`,
    values: ["free", `${subId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error changing plan_tier from keys DB table",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return
  }
}

export async function clearSubsciptionApiKey(subId: string) {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'update api_users set stripe_subscription_id = NULL where stripe_subscription_id = $1',
    values: [`${subId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error clearing stripe_subscription_id from api_users DB table",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return
  }
}

export async function clearCustomerApiUser(custId: string) {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'update api_users set stripe_customer_id = NULL where stripe_customer_id = $1',
    values: [`${custId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error clearing stripe_customer_id from api_users DB table",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return
  }
}

export async function setTokenPlanLimits(hash: string, tiers: any, oldLimits?: KeyLimit[]) {

  // expire time is Date.now() in epoch + 31 days in milliseconds
  const expireEpoch = Date.now() + tiers.sales.duration * 1000
  let dbQuery: QueryConfig<any[]>

  if (typeof oldLimits !== "undefined") {
    // reuse old limits
    let text: string = 'insert into key_limits(key, points, expire) values'
    let values: string[] = []
    let count: number = 1
    oldLimits.forEach(row => {
      const head = row.key.split(":")
      text = text + `($${count++}, $${count++}, $${count++}),`
      values.push(`${head[0]}:${hash}`)
      values.push(row.points.toString())
      values.push(row.expire.toString())
    })
    dbQuery = {
      text: text.slice(0, -1), // remove trailing comma
      values: values
    }
  } else {
    // start fresh
    dbQuery = {
      text: 'insert into key_limits(key, points, expire) values($1, 0, $2),($3, 0, $2)',
      values: [`${tiers.sales.keyPrefix}:${hash}`, `${expireEpoch}`, `${tiers.txs.keyPrefix}:${hash}`]
    }
  }

  try {
    await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error inserting key_limits into DB",
      component: "backend-api",
      error: e.message,
      hash: hash,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
  }
}

export async function deleteTokenPlanLimits(oldHash: string) {

  let dbQuery: QueryConfig<any[]>
  dbQuery = {
    text: 'delete from key_limits where key like $1',
    values: [`%:${oldHash}`]
  }

  try {
    await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error deleting row(s) from key_limits table",
      component: "backend-api",
      error: e.message,
      old_hash: oldHash,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
  }
}

export async function getTokenPlanLimits(hash: string): Promise<KeyLimit[] | undefined> {

  const kLimits: KeyLimit[] = []
  let dbResp: QueryResult<any> | undefined

  const dbQuery: QueryConfig<any[]> = {
    text: 'select key, points, expire from key_limits where key like $1',
    values: [`%:${hash}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error getting key_limits from DB",
      component: "backend-api",
      error: e.message,
      hash: hash,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  if (dbResp.rowCount === 0) {
    return undefined
  }

  dbResp.rows.forEach(row => {
    const k = new KeyLimit(row.key, row.points, row.expire)
    kLimits.push(k)
  })

  return kLimits

}

export async function updateLastUsedTime(hash: string) {
  const dbQuery: QueryConfig<any[]> = {
    text: 'update keys set last_used_time = current_timestamp where hash = $1',
    values: [`${hash}`]
  }

  try {
    await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error updating DB for last_used_time column in keys table",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
  }
}

export async function getApiKeyByUser(user: string): Promise<ApiKey | undefined> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select * from keys where "user" = $1',
    values: [`${user}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error querying DB for all api key columns in keys table by user",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  if (dbResp.rowCount === 0) {
    return undefined
  }

  return new ApiKey(
    dbResp.rows[0].id,
    dbResp.rows[0].hash,
    dbResp.rows[0].prefix,
    dbResp.rows[0].create_time,
    dbResp.rows[0].expire_time,
    dbResp.rows[0].plan_tier,
    dbResp.rows[0].user,
    dbResp.rows[0].status,
    dbResp.rows[0].last_used_time,
  )
}

export async function getApiKeyByPrefix(pFix: string): Promise<ApiKey | DBError> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select * from keys where prefix = $1',
    values: [`${pFix}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error querying DB for all api key columns in keys table by prefix",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return new DBError("db call failed", 500)
  }

  if (dbResp.rowCount === 0) {
    return new DBError("api_key is not valid", 403)
  }

  return new ApiKey(
    dbResp.rows[0].id,
    dbResp.rows[0].hash,
    dbResp.rows[0].prefix,
    dbResp.rows[0].create_time,
    dbResp.rows[0].expire_time,
    dbResp.rows[0].plan_tier,
    dbResp.rows[0].user,
    dbResp.rows[0].status,
    dbResp.rows[0].last_used_time,
  )
}

export async function getApiUser(user: string): Promise<ApiUser | undefined> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select * from api_users where name = $1',
    values: [`${user}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error querying DB for all api user columns in api_users table",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  if (dbResp.rowCount === 0) {
    return undefined
  }

  return new ApiUser(
    dbResp.rows[0].id,
    dbResp.rows[0].name,
    dbResp.rows[0].wallet_addr,
    dbResp.rows[0].stripe_customer_id,
    dbResp.rows[0].stripe_subscription_id,
  )
}

export async function getTierPlan(priceId: string): Promise<string> {

  const kLimits: KeyLimit[] = []
  let dbResp: QueryResult<any> | undefined

  const dbQuery: QueryConfig<any[]> = {
    text: 'select name from plan_tiers where stripe_price_id = $1 or stripe_price_id_test = $1',
    values: [`${priceId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error getting plan_tiers from DB",
      component: "backend-api",
      error: e.message,
      price_id: priceId,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return "free"
  }

  if (dbResp.rowCount === 0) {
    return "free"
  }

  return dbResp.rows[0].name

}

export async function checkKeyPrefix(prefix: string): Promise<boolean | number> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select prefix from keys where prefix = $1',
    values: [`${prefix}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error querying DB for prefix column in keys table",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return 500
  }

  if (dbResp.rowCount > 0) {
    return false
  }

  return true
}

export async function getStripeCustomer(user: string): Promise<string | undefined> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select stripe_customer_id from api_users where name = $1',
    values: [`${user}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "error querying DB for stripe_customer_id column in api_users table",
      component: "backend-api",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  if (dbResp.rowCount === 0) {
    return undefined
  }

  if (dbResp.rows[0].stripe_customer_id) {
    return dbResp.rows[0].stripe_customer_id
  } else {
    return undefined
  }
}

export async function executeDBQuery(query: QueryConfig<any[]>, pool: Pool = apiKeyPool, asPg: boolean = false): Promise<QueryResult<any>> {

  // use prod unless this is a test environment
  // if (!asPg) {
  //   //console.log("query", query)
  //   switch (process.env.NODE_ENV) {
  //     case 'test':
  //       pool = testApiKeysPool
  //       break
  //   }
  // }

  return new Promise((resolve, reject) => {

    pool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err

      client
        .query(query)
        .then(res => {
          release()
          resolve(res)
        })
        .catch(e => {
          release()
          reject(e)
        })
    })
  })
}
