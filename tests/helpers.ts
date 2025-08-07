import { createServer } from '../src/server'
import express, { Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { QueryConfig, QueryResult } from "pg"
import { executeDBQuery, updateLastUsedTime } from "../src/api/utils/db"
import { rateLimiterPgMiddleware } from "../src/middlewares/rateLimiterPg"
import apiKeysRouter from "../src/api/apiKeys.route"
// import { testApiKeyUserPass } from "../src/consts/users"
import { testPool } from './pools'

// const createUserQuery = `
//   GRANT CONNECT ON DATABASE test_apikeys TO postgres;
//   CREATE USER test_apikeys with encrypted password '${testApiKeyUserPass}';
//   GRANT CONNECT ON DATABASE test_apikeys TO test_apikeys;
//   GRANT ALL privileges on DATABASE test_apikeys to test_apikeys;
//   ALTER USER test_apikeys WITH SUPERUSER;
// `

const createApiUsersTable = `
  CREATE TABLE IF NOT EXISTS api_users (
    id                     integer unique not null,
    name                   text primary key unique not null,
    wallet_addr            text unique null,
    stripe_customer_id     text unique null,
    stripe_subscription_id text unique null
  );

  CREATE SEQUENCE IF NOT EXISTS public.api_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

  ALTER SEQUENCE public.api_users_id_seq OWNER TO test_apikeys;

  ALTER SEQUENCE public.api_users_id_seq OWNED BY public.api_users.id;

  ALTER TABLE ONLY public.api_users ALTER COLUMN id SET DEFAULT nextval('public.api_users_id_seq'::regclass);
`

const createKeyLimitsTable = `
  CREATE TABLE IF NOT EXISTS key_limits (
    key    character varying(255) primary key unique not null,
    points integer default 0 not null,
    expire bigint null
  );
`

const createKeyStatusTable = `
  CREATE TABLE IF NOT EXISTS key_status (
    id     integer unique not null,
    status text primary key not null
  );

  CREATE SEQUENCE IF NOT EXISTS public.key_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

  ALTER SEQUENCE public.key_status_id_seq OWNER TO test_apikeys;

  ALTER SEQUENCE public.key_status_id_seq OWNED BY public.key_status.id;

  ALTER TABLE ONLY public.key_status ALTER COLUMN id SET DEFAULT nextval('public.key_status_id_seq'::regclass);
`

const createPlanTiersTable = `
  CREATE TABLE IF NOT EXISTS public.plan_tiers (
    id                   integer unique not null,
    name                 text primary key not null,
    stripe_price_id      text,
    stripe_price_id_test text
  );

  CREATE SEQUENCE IF NOT EXISTS public.plan_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

  ALTER SEQUENCE public.plan_tiers_id_seq OWNER TO test_apikeys;

  ALTER SEQUENCE public.plan_tiers_id_seq OWNED BY public.plan_tiers.id;

  ALTER TABLE ONLY public.plan_tiers ALTER COLUMN id SET DEFAULT nextval('public.plan_tiers_id_seq'::regclass);
`

const createKeysTable = `
  CREATE TABLE IF NOT EXISTS keys (
    id             integer primary key not null,
    hash           text unique not null,
    create_time    timestamp with time zone not null,
    expire_time    timestamp with time zone not null,
    last_used_time timestamp with time zone,
    prefix         text unique not null,
    "user"         text unique not null,
    status         text not null,
    plan_tier      text default 'free'::text not null
  );

  CREATE SEQUENCE IF NOT EXISTS public.keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

  ALTER SEQUENCE public.keys_id_seq OWNER TO test_apikeys;

  ALTER SEQUENCE public.keys_id_seq OWNED BY public.keys.id;

  ALTER TABLE ONLY public.keys ALTER COLUMN id SET DEFAULT nextval('public.keys_id_seq'::regclass);

  ALTER TABLE ONLY public.keys ADD CONSTRAINT keys_plan_tier_fkey FOREIGN KEY (plan_tier) REFERENCES public.plan_tiers(name);
  ALTER TABLE ONLY public.keys ADD CONSTRAINT keys_status_fkey FOREIGN KEY (status) REFERENCES public.key_status(status);
  ALTER TABLE ONLY public.keys ADD CONSTRAINT keys_user_fkey FOREIGN KEY ("user") REFERENCES public.api_users(name);
`

const createUsers = `
  INSERT INTO api_users (name) VALUES ('test-user-free');
  INSERT INTO api_users (name, stripe_customer_id, stripe_subscription_id) VALUES ('test-user-small', 'cus_Oq4qzQXbtjEUXd', 'sub_1O2Oh0ApRbPzcPEh7M1bmogy');
`

const createKeyStatus = `
  INSERT INTO key_status (status) VALUES ('active');
  INSERT INTO key_status (status) VALUES ('inactive');
`

const createPlanTiers = `
  INSERT INTO plan_tiers (name) VALUES ('free');
  INSERT INTO plan_tiers (name, stripe_price_id_test) VALUES ('small', 'price_1NxrwRApRbPzcPEhAj832H8j');
  INSERT INTO plan_tiers (name, stripe_price_id_test) VALUES ('medium', 'price_1NxrwZApRbPzcPEhyyHLPx74');
  INSERT INTO plan_tiers (name) VALUES ('large');
  INSERT INTO plan_tiers (name) VALUES ('enterprise');
`

// export async function runMigrations(): Promise<string | undefined> {
//   const createDB: QueryConfig<any[]> = {
//     text: 'CREATE DATABASE test_apikeys',
//     values: []
//   }

//   const createUser: QueryConfig<any[]> = {
//     text: `
//       ${createUserQuery}
//     `,
//     values: []
//   }

//   const migrations: QueryConfig<any[]> = {
//     text: `
//       ${createApiUsersTable}
//       ${createKeyLimitsTable}
//       ${createKeyStatusTable}
//       ${createPlanTiersTable}
//       ${createKeysTable}
//       ${createUsers}
//       ${createKeyStatus}
//       ${createPlanTiers}
//     `,
//     values: []
//   }

//   let dbResp: QueryResult<any> | undefined

//   try {
//     await cleanUp()
//   } catch (e) {
//     console.log(e)
//     return undefined
//   }

//   try {
//     dbResp = await executeDBQuery(createDB, testPool, true)
//   } catch (e) {
//     console.log(e)
//     return undefined
//   }

//   try {
//     dbResp = await executeDBQuery(createUser, testPool, true)
//   } catch (e) {
//     console.log(e)
//     return undefined
//   }

//   try {
//     dbResp = await executeDBQuery(migrations)
//   } catch (e) {
//     console.log(e)
//     return undefined
//   }

//   return await validateMigrations()

// }

async function validateMigrations(): Promise<string | undefined> {

  const validateDB: QueryConfig<any[]> = {
    text: 'SELECT datname FROM pg_catalog.pg_database WHERE datname = $1',
    values: ["test_apikeys"]
  }

  let dbResp: QueryResult<any> | undefined

  try {
    dbResp = await executeDBQuery(validateDB, testPool, true)
  } catch (e) {
    console.log(e)
    return undefined
  }

  if (typeof dbResp === 'undefined') {
    return undefined
  }

  if (dbResp.rowCount === 0) {
    return undefined
  }

  return "everything is setup"
}

export async function truncateTables(): Promise<string | undefined> {
  const truncateKeyLimits: QueryConfig<any[]> = {
    text: 'TRUNCATE key_limits',
    values: []
  }

  const truncateKeys: QueryConfig<any[]> = {
    text: 'TRUNCATE keys',
    values: []
  }

  try {
    await executeDBQuery(truncateKeyLimits)
  } catch (e) {
    console.log(e)
    return undefined
  }

  try {
    await executeDBQuery(truncateKeys)
  } catch (e) {
    console.log(e)
    return undefined
  }

  return "truncate done"
}

export async function cleanUp(): Promise<string | undefined> {

  const dropDB: QueryConfig<any[]> = {
    text: 'DROP DATABASE IF EXISTS test_apikeys',
    values: []
  }

  const dropUser: QueryConfig<any[]> = {
    text: 'DROP USER IF EXISTS test_apikeys',
    values: []
  }

  try {
    await executeDBQuery(dropDB, testPool, true)
  } catch (e) {
    console.log(e)
    return undefined
  }

  try {
    await executeDBQuery(dropUser, testPool, true)
  } catch (e) {
    console.log(e)
    return undefined
  }

  return "clean up done"

}

const app = createServer()

const router = express.Router()

router.options('*', async (req: Request, res: Response) => {
  res.status(200)
})

router.get('/test', async (req: Request, res: Response) => {

  const uuid = uuidv4()

  res.locals.planLimit.consume(res.locals.hash)
    .then(async (rateLimiterRes: any) => {
      const headers = {
        "Retry-After": rateLimiterRes.msBeforeNext / 1000,
        "X-RateLimit-Limit": res.locals.opts.points,
        "X-RateLimit-Remaining": rateLimiterRes.remainingPoints,
        "X-RateLimit-Reset": new Date(Date.now() + rateLimiterRes.msBeforeNext)
      }
      res.set(headers)
      res.send({ "trace_id": uuid })

      // update last_used_time column for apikey
      await updateLastUsedTime(res.locals.hash)
    })
    .catch((rateLimiterRes: any) => {
      const headers = {
        "Retry-After": rateLimiterRes.msBeforeNext / 1000,
        "X-RateLimit-Limit": res.locals.opts.points,
        "X-RateLimit-Remaining": rateLimiterRes.remainingPoints,
        "X-RateLimit-Reset": new Date(Date.now() + rateLimiterRes.msBeforeNext)
      }
      res.set(headers)
      res.status(429).send({ "trace_id": uuid, "error": "no more requests available :( please purchase an upgraded tier or wait for monthly limit to reset" })
    })
})

app.use('/api/keys', apiKeysRouter)
app.use('/api/v1/sales', rateLimiterPgMiddleware, router)
app.use('/api/v1/txs', rateLimiterPgMiddleware, router)

export const testserver = app.listen(4444, () => { })
