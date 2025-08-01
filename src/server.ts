/*
TODO:
- ADD TIMESTAMPS TO LOGS

- todo: read in the database settings / passwords etc from a file
- make a method to add descriptions or update shit on collections maybe? might be quicker than logging into the node.
will have to make sure it's secured though. updating itself isn't that much of an issue. inserting could cause scams
- call for all sales, have ?status param(active,inactive,complete,cancelled) ?collection (collection name as text)
- call for valid addresses - provide all as long list for ease, doesn't need to be filtered by collection
- call for prices of collection completed sales,  ?start-date ?end-date. will return array of dates, with items { 'floor':'12', 'avg':'123' } or something
- ADD PG USER FOR READ-ONLY, USE THAT USER IN THIS API. THIS API is NO-UPDATE. NO FKKN UPDATES.

- check logger docs for prod setting, 404 should not display our server file structure
*/

// @ts-ignore
import { initConsts } from "./consts/apiConsts"

import compression from "compression"
import createError, { HttpError } from "http-errors"
import express, { Application, NextFunction, Request, Response } from "express"
import bodyParser from "body-parser"
import { Pool } from "pg"
import cors from "cors"
import path from "path"
import cookieParser from "cookie-parser"
import { rateLimiterPgMiddleware } from "./middlewares/rateLimiterPg"
import morganMiddleware from "./middlewares/morganMiddleware"
import PgBoss from "pg-boss"
import { deactivateSubscriptionApiKey, updateApiKeyWithSubscription, getQueuedJobs } from './api/utils/db'
import promClient from "./metrics/prometheus"
import logger from "./logger"
import * as dotenv from "dotenv"

import routesRouter from "./api/routes.route"
import transactionRouter from "./api/transaction.route"
import collectionsRouter from "./api/collections.route"
import salesRouter from "./api/sales.route"
import ergopayRouter from "./api/ergopay.route"
import metricsRouter from "./api/metrics.route"
import utilsRouter from "./api/utils.route"
import transactionsRouter from "./api/transactions/transactions.route"
import apiKeysRouter from "./api/apiKeys.route"
import stripeRouter from "./api/stripe.route"
import scannerRouter from "./api/scanner.route"
import pubTestKeySalesRouter from "./api/public/sales/test.route"
import pubTestKeyTxsRouter from "./api/public/txs/test.route"

declare global {
  var pgboss: PgBoss
  var queuedJobs: string[]
}

const envFilePath = path.resolve(process.cwd(), './.env')
dotenv.config({ path: envFilePath })


const apiKeyUser = process.env.API_KEY_USER
const apiKeyUserPass = process.env.API_KEY_USER_PASS
const siteUser = process.env.SITE_USER
const siteUserPass = process.env.SITE_USER_PASS
const epayUser = process.env.ERGO_PAY_USER
const epayUserPass = process.env.ERGO_PAY_USER_PASS

function shouldCompress(req: Request, res: Response) {
  if (req.headers["x-no-compression"]) {
    // don't compress responses with this request header
    return false;
  }

  // fallback to standard filter function
  return compression.filter(req, res);
}



// Need to modularize this to run jest test cases
export function createServer(): Application {
  const app: Application = express()

  app.use(compression({ filter: shouldCompress }))
  // view engine setup
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'jade');
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  // we need to parse the Request body as json as well as raw Buffer for Stripe webhook events
  // TODO: need to analyze the performance of doubling the size of the request body
  app.use(bodyParser.json({
    verify: (req: Request, res, buf: Buffer) => {
      req.rawBody = buf
    }
  }))

  app.use(express.static(path.join(__dirname, 'public')));

  return app
}

const DB_HOST_ADDR = process.env.DB_HOST_ADDR || "localhost"

const sApiPool = new Pool({
  host: DB_HOST_ADDR,
  port: 5432,
  database: "skyharbor",
  user: siteUser,
  password: siteUserPass,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
  // 50 seems functional, probably should be less.
  max: 50,
});

const ePayPool = new Pool({
  host: DB_HOST_ADDR,
  port: 5432,
  database: "ergopay",
  user: epayUser,
  password: epayUserPass,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
  max: 50,
});

// use pgboss for non test environments
// if (process.env.NODE_ENV !== 'test') {
//   globalThis.queuedJobs = []
//   globalThis.pgboss = new PgBoss(`postgres://${apiKeyUser}:${apiKeyUserPass}@${DB_HOST_ADDR}/apikeys`)
//   globalThis.pgboss.on('error', error => logger.error({ message: error, component: "backend-api" }))
//   globalThis.pgboss.start().then(async () => {
//     let count = 0
//     const jobs = await getQueuedJobs('subscription-tasks')
//     if (typeof jobs !== "undefined") {
//       count = jobs.length
//       globalThis.queuedJobs = jobs
//     }
//     logger.info({ message: "pgboss started", component: "backend-api", queued_jobs: count })
//   })

//   globalThis.pgboss.work('subscription-tasks', { newJobCheckIntervalSeconds: 300 }, async (job: any) => {
//     if (job.data.task === "deactivate") {
//       deactivateSubscriptionApiKey(job.data.subscription_id)
//     } else if (job.data.task === "downgrade") {
//       updateApiKeyWithSubscription(job.data.subscription_id, job.data.price_id)
//     }
//     // remove job from local queue
//     const idx = globalThis.queuedJobs.findIndex((id) => id === job.id)
//     if (idx !== -1) {
//       globalThis.queuedJobs.splice(idx, 1)
//     }
//     logger.info({
//       message: "job from subscription-tasks queue completed",
//       component: "backend-api",
//       task: job.data.task,
//       subscription_id: job.data.subscription_id
//     })
//   })
// }

const app: Application = createServer()

app.use(morganMiddleware);
app.use('/api/routes', cors(), routesRouter);
app.use('/api/transaction', cors(), transactionRouter);
app.use('/api/collections', cors(), collectionsRouter);
app.use('/api/sales', cors(), salesRouter);
app.use('/api/ergopay', ergopayRouter);
app.use('/api/metrics', cors(), metricsRouter);
app.use('/api/utils', cors(), utilsRouter);
app.use('/api/transactions', cors(), transactionsRouter);
app.use('/api/keys', cors(), apiKeysRouter);
app.use('/api/stripe', cors(), stripeRouter);
app.use('/api/scanner', cors(), scannerRouter);
app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', promClient.register.contentType)
  res.end(await promClient.register.metrics())
})
// public facing APIs with rate limiting
app.use('/api/v1/sales', rateLimiterPgMiddleware, pubTestKeySalesRouter);
app.use('/api/v1/txs', rateLimiterPgMiddleware, pubTestKeyTxsRouter);

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

// error handler
app.use(function (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // set locals, only providing error in development
  // res.locals.message = err.message;
  // res.locals.error = req.app.get('env') === 'development' ? err : {};
  // render the error page
  res.status(err.status || 500);
  // res.render('error');
  res.send();
});

export default app;

export const siteApiPool = sApiPool;
export const ergoPayPool = ePayPool;
export const consts = (async () => {
  logger.info({ message: "Initialising necessary memory from db...", component: "backend-api" })
  const c = await initConsts();
  if (c !== undefined) { logger.info({ message: "db mem loaded!", component: "backend-api" }) }
  return c
})();
