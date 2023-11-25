import { Pool } from 'pg'
import { testApiKeyUser, testApiKeyUserPass, postgresUser, postgresUserPass } from '../src/consts/users'

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