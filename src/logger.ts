import winston from 'winston'
import os from 'os'
import * as dotenv from "dotenv"
import path from "path"
import LokiTransport from 'winston-loki-v2'

const envFilePath = path.resolve(process.cwd(), './.env')
dotenv.config({ path: envFilePath })

const hostname = os.hostname()
const ENV = process.env.NODE_ENV || 'development'
const LOKI_ENDPOINT = process.env.LOKI_ENDPOINT || 'http://127.0.0.1:3100'
const LOKI_ENABLED = Boolean(process.env.LOKI_ENABLED) || false
const LOKI_USERNAME = process.env.LOKI_USERNAME || ''
const LOKI_PASSWORD = process.env.LOKI_PASSWORD || ''
const LOKI_API_TOKEN = process.env.LOKI_API_TOKEN || ''

const levels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
}

const level = () => {
  const isDevelopment = ENV === 'development' || ENV === 'local'
  return isDevelopment ? 'debug' : 'info'
}

const format = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss:ms' }),
  winston.format.json(),
)

const transports = [
  new winston.transports.Console(),
]

const labels = {
  hostname: `${hostname}`,
  app: "skyharbor-backend",
  env: ENV,
}

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  defaultMeta: labels,
  transports,
})

if (LOKI_ENABLED) {
  logger.add(new LokiTransport({
    host: LOKI_ENDPOINT,
    json: true,
    headers: LOKI_API_TOKEN !== '' ? { 'Authorization': `Bearer ${LOKI_API_TOKEN}` } : undefined,
    basicAuth: (LOKI_USERNAME !== '' && LOKI_PASSWORD !== '') ? `${LOKI_USERNAME}:${LOKI_PASSWORD}` : undefined,
    labels: labels,
    format: format,
    timeout: 120000,
    clearOnError: true,
    onConnectionError: (err) => console.error("Loki connection error", err)
  }))
}

export default logger
