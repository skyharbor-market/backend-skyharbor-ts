#!/usr/bin/env node

/**
 * Module dependencies.
 */

import app from "./server";
import dotenv from "dotenv";
import logger from "./logger";
import { spawn, Thread, Worker } from "threads";
import { SSWorker } from "./workers/salesScanner";
import { metrics } from "./metrics/prometheus";

dotenv.config();
const host = process.env.HOST || "0.0.0.0";

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || "8080");

/**
 * Listen on provided port, on all network interfaces.
 */

app.on("error", onError);

export const server = app.listen(Number(port), host, async () => {
  logger.info({ message: `listening on port ${port}`, component: "backend-api" });
});

declare global {
  var ssWorker: any;
}

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: string): number | string | boolean {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error: any) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      logger.error({ message: `${bind} requires elevated privileges`, component: "backend-api" });
      process.exit(1);
    case "EADDRINUSE":
      logger.error({ message: `${bind} is already in use`, component: "backend-api" });
      process.exit(1);
    default:
      throw error;
  }
}

// spawn sales scanner worker thread
(async () => {
  globalThis.ssWorker = await spawn<SSWorker>(new Worker("./workers/salesScanner.ts"));
  try {
    globalThis.ssWorker.values().subscribe((log: any) => {
      try {
        logger.info(Object.assign({}, { component: "sales-scanner" }, log));
      } catch (error) {
        console.error("sales scanner failed to log message", error);
      }
    });
    globalThis.ssWorker.metrix().subscribe((event: any) => {
      // TODO: figure out a better way to do this
      switch (event.name) {
        case "newTokenSuccessCounter":
          metrics.newTokenSuccessCounter.labels(...event.labels).inc();
          break;
        case "newTokenFailedCounter":
          metrics.newTokenFailedCounter.labels(...event.labels).inc();
          break;
      }
    });
    try {
      await globalThis.ssWorker.init();
    } catch (error) {
      logger.error({
        message: `failed to create sales scanner worker: ${error.message}`,
        component: "sales-scanner",
      });
      throw error;
    }

    try {
      await globalThis.ssWorker.loadActiveSalesAddresses();
    } catch (error) {
      logger.error({
        message: `failed to load active sales addresses: ${error.message}`,
        component: "sales-scanner",
      });
      throw error;
    }

    try {
      await globalThis.ssWorker.deactivateSalesNotOnActiveAddresses();
    } catch (error) {
      logger.error({
        message: `failed to deactivate sales not on active addresses: ${error.message}`,
        component: "sales-scanner",
      });
      throw error;
    }

    try {
      await globalThis.ssWorker.reactivateSalesOnActiveAddresses();
    } catch (error) {
      logger.error({
        message: `failed to reactivate sales on active addresses: ${error.message}`,
        component: "sales-scanner",
      });
      throw error;
    }

    // load existing ACTIVE sales from database into internal activeSalesUnderAllSa list
    try {
      await globalThis.ssWorker.getPastProcessedActiveBoxes();
    } catch (error) {
      logger.error({
        message: `failed to get past processed active boxes - ${error.message}`,
        component: "sales-scanner",
      });
      throw error;
    }

    //scan active addresses and update db with new sales
    try {
      await globalThis.ssWorker.processNewSales();
    } catch (error) {
      logger.error({
        message: `failed to process new sale(s) - ${error.message}`,
        component: "sales-scanner",
      });
      throw error;
    }

    // TODO: scan back through initialBlockScan to find any sales that listed and completed while s-s was offline

    // grab all boxes created in initBlockScan time period, filtered for spent (unspent grabbed and processed above.)
    // process each spent box
    // if token does not exist on db yet,
    // get token info and add token to db
    // if box is not on sales database already
    // decipher box spend tx and update sales db as complete or cancelled

    // process straggling inactive sales
    try {
      await globalThis.ssWorker.processInactiveSales();
    } catch (error) {
      logger.error({
        message: `failed to process inactive sales - ${error.message}`,
        component: "sales-scanner",
      });
      throw error;
    }

    try {
      await globalThis.ssWorker.scannerLoop();
    } catch (error) {
      logger.error({
        message: `infinite scanner loop errored - ${error.message}`,
        component: "sales-scanner",
      });
      throw error;
    }
  } catch (error) {
    console.error("sales scanner worker thread errored", error);
    logger.error({
      message: `sales scanner worker thread errored - ${error.message}`,
      component: "sales-scanner",
    });
  } finally {
    globalThis.ssWorker.finish();
    await Thread.terminate(globalThis.ssWorker);
  }
})();
