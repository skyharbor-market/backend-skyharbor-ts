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
import { siteUser, siteUserPass, epayUser, epayUserPass } from "./consts/users"
import { certLinks } from "./consts/prodConfig"
import { initConsts } from "./consts/apiConsts"

import compression from "compression"
import createError, { HttpError } from "http-errors"
import express, { Application, NextFunction, Request, Response } from "express"
import { Pool } from "pg"
import cors from "cors"
import path from "path"
import cookieParser from "cookie-parser"
import logger from "morgan"

import routesRouter from "./api/routes.route"
import transactionRouter from "./api/transaction.route"
import collectionsRouter from "./api/collections.route"
import salesRouter from "./api/sales.route"
import ergopayRouter from "./api/ergopay.route"
import ergoauthRouter from "./api/ergoauth.route"
import metricsRouter from "./api/metrics.route"
import utilsRouter from "./api/utils.route"

const app: Application = express();

app.use(compression({ filter: shouldCompress }))

function shouldCompress(req: Request, res: Response) {
  if (req.headers['x-no-compression']) {
    // don't compress responses with this request header
    return false
  }

  // fallback to standard filter function
  return compression.filter(req, res)
}

// app.use(cors());

const sApiPool = new Pool({
  host: "localhost",
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
  host: "localhost",
  port: 5432,
  database: "ergopay",
  user: epayUser,
  password: epayUserPass,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
  // 50 seems functional, probably should be less.
  max: 50
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
//todo: is there a setting for prod?
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use('/api/routes', cors(), routesRouter);
app.use('/api/transaction', cors(), transactionRouter);
app.use('/api/collections', cors(), collectionsRouter);
app.use('/api/sales', cors(), salesRouter);
app.use('/api/ergopay', ergopayRouter);
app.use('/api/ergoauth', ergoauthRouter);
app.use('/api/metrics', cors(), metricsRouter);
app.use('/api/utils', cors(), utilsRouter);

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

// error handler
app.use(function (err: HttpError, req: Request, res: Response, next: NextFunction) {
  // set locals, only providing error in development
  // res.locals.message = err.message;
  // res.locals.error = req.app.get('env') === 'development' ? err : {};
  // render the error page
  res.status(err.status || 500);
  // res.render('error');
  res.send();
});


export default app

export const siteApiPool = sApiPool
export const ergoPayPool = ePayPool
export const consts = (async () => {
  console.log("Initialising necessary memory from db...");
  const c = await initConsts();
  if (c !== undefined) { console.log("db mem loaded!"); }
  return c
})();