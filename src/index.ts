#!/usr/bin/env node

/**
 * Module dependencies.
 */

import app from "./server"
import dotenv from "dotenv"
import logger from "./logger"

dotenv.config()
const host = process.env.HOST || "0.0.0.0"

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '8080');

/**
 * Listen on provided port, on all network interfaces.
 */

app.on('error', onError)

export const server = app.listen(Number(port), host, async () => {
  logger.info(`listening on port ${port}!`)
})

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
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`)
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`)
      process.exit(1);
      break;
    default:
      throw error;
  }
}