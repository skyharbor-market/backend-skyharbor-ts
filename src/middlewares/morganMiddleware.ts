import morgan from "morgan"
import logger from "../logger"

const stream = {
  write: (message: any) => logger.info(message),
}

const skip = () => {
  // const env = process.env.NODE_ENV || "development"
  // return env !== "development"
  return false
}

const morganMiddleware = morgan(
  ":remote-addr :method :url :status :res[content-length] - :response-time ms",
  { stream, skip }
)

export default morganMiddleware