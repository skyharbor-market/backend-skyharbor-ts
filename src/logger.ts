import winston from 'winston'
import os from 'os'

const hostname = os.hostname()
const env = process.env.NODE_ENV || 'development'

const levels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
}

const level = () => {
  const isDevelopment = env === 'development' || env === 'local'
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
  env: env,
}

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  defaultMeta: labels,
  transports,
})

export default logger