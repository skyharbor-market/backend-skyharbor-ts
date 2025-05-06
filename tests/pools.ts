import { Pool } from 'pg'

import * as dotenv from "dotenv"
import path from "path"

const envFilePath = path.resolve(process.cwd(), './.env')
dotenv.config({ path: envFilePath })

const testApiKeyUser = process.env.TEST_API_KEY_USER
const testApiKeyUserPass = process.env.TEST_API_KEY_USER_PASS
const postgresUser = process.env.POSTGRES_USER
const postgresUserPass = process.env.POSTGRES_USER_PASS

export const testPool = new Pool({
  host: "localhost",
  port: 5432,
  user: postgresUser,
  password: postgresUserPass,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
  max: 5,
})

export const testApiKeysPool = new Pool({
  host: "localhost",
  port: 5432,
  database: "test_apikeys",
  user: testApiKeyUser,
  password: testApiKeyUserPass,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
  max: 5,
})