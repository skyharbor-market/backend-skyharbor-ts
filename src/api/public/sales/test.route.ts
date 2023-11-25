import express, { Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { updateLastUsedTime } from "../../utils/db"

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

export default router