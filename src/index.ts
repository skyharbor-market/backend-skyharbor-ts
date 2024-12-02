#!/usr/bin/env node

/**
 * Module dependencies.
 */

import app from "./server";
import dotenv from "dotenv";
import logger from "./logger";
import { spawn, Thread, Worker } from "threads";
import { SSWorker } from "./workers/salesScanner";

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
  logger.info(`listening on port ${port}!`);
});

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
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

// spawn sales scanner worker thread
(async () => {
  const ssWorker = await spawn<SSWorker>(new Worker("./workers/salesScanner.ts"));
  try {
    ssWorker.values().subscribe((log: any) => {
      logger.info(log);
    });
    try {
      await ssWorker.init();
    } catch (error) {
      logger.error("failed to create sales scanner worker:", error);
      throw error;
    }

    try {
      await ssWorker.loadActiveSalesAddresses();
    } catch (error) {
      logger.error("failed to load active sales addresses:", error);
      throw error;
    }

    try {
      await ssWorker.deactivateSalesNotOnActiveAddresses();
    } catch (error) {
      logger.error("failed to deactivate sales not on active addresses:", error);
      throw error;
    }

    try {
      await ssWorker.reactivateSalesOnActiveAddresses();
    } catch (error) {
      logger.error("failed to reactivate sales on active addresses:", error);
      throw error;
    }

    // load existing ACTIVE sales from database into internal activeSalesUnderAllSa list
    try {
      await ssWorker.getPastProcessedActiveBoxes();
    } catch (error) {
      logger.error("failed to get past processed active boxes:", error);
      throw error;
    }

    //scan active addresses and update db with new sales
    try {
      await ssWorker.processNewSales();
    } catch (error) {
      logger.error("failed to process new sale(s):", error);
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
      await ssWorker.processInactiveSales();
    } catch (error) {
      logger.error("failed to process inactive sales:", error);
      throw error;
    }

    try {
      await ssWorker.scannerLoop();
    } catch (error) {
      logger.error("infinite scanner loop errored:", error);
      throw error;
    }
  } catch (error) {
    logger.error("sales scanner worker thread errored:", error);
  } finally {
    ssWorker.finish();
    await Thread.terminate(ssWorker);
  }
})();
