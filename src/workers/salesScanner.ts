import { Observable, Subject } from "threads/observable"
import { expose } from "threads/worker"
import { SalesScanner } from "../classes/salesScanner"
import {
  getCurrentBlockHeight,
  getMainWalletAddress
} from "../ergofunctions/node"
import {
  getAllUtxosByAddress,
  redundancyGetUtxosMempoolOnly
} from "../ergofunctions/explorer"
import { checkBalancePayTeamWithInputLimit } from "../functions/payteam"
import {
  getActiveSalesAddresses,
  deactivateSalesNotOnActiveAddresses,
  reactivateSalesOnActiveAddresses,
  getAllActiveSales,
  getAllInactiveSales } from "../scanner/db"
import { SalesAddress } from "../classes/salesAddress"

import * as dotenv from "dotenv"
import path from "path"

const envFilePath = path.resolve(process.cwd(), './.env')
dotenv.config({ path: envFilePath })

const SCANNER_BLOCK_POLL_RATE_MS = Number(process.env.SCANNER_BLOCK_POLL_RATE_MS) || 20000

const sleep = async (durationMs: number) => {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}

const scanner = new SalesScanner()
let logger = new Subject()
let currentHeight: number = 1

const salesScanner = {
  async init() {
    try {
      // loop to check if ergo node is up
      currentHeight = await getCurrentBlockHeight()
      while (currentHeight === 0) {
        logger.next({ message: "cannot communicate with ergo node, retrying in 10 seconds", node_endpoint: process.env.NODE_BASE_URL})
        await sleep(10000)
        currentHeight = await getCurrentBlockHeight()
      }

      // obtain node wallet main address
      const nodeMainAddr = await getMainWalletAddress()
      if (nodeMainAddr === "") {
        throw new Error("no node wallet address found")
      } else if (typeof nodeMainAddr !== "string") {
        throw nodeMainAddr
      }

      scanner.NODE_MAIN_WALLET_ADDRESS = nodeMainAddr

      // log sales scanner config info
      logger.next({ message: `${scanner.toString()}` })

    } catch (error) {
      throw error
    }
  },
  async loadActiveSalesAddresses() {
    try {
      const salesAddrs = await getActiveSalesAddresses()
      if (typeof salesAddrs === 'undefined') {
        throw new Error("getActiveSalesAddresses() returned undefined")
      }
      salesAddrs.rows.forEach((row) => {
        const sa = new SalesAddress(Number(row.id), row.address, row.currency, row.version, true)
        scanner.SalesAddresses.push(sa)
      })

      logger.next({ message: 'active sales addresses loaded', active_sales_count: salesAddrs.rows.length })
    } catch(error) {
      throw error
    }
  },
  async deactivateSalesNotOnActiveAddresses() {
    try {
      await deactivateSalesNotOnActiveAddresses(scanner.SalesAddresses)
    } catch(error) {
      throw error
    }
  },
  async reactivateSalesOnActiveAddresses() {
    try {
      await reactivateSalesOnActiveAddresses(scanner.SalesAddresses)
    } catch(error) {
      throw error
    }
  },
  async getPastProcessedActiveBoxes() {
    try {
      const activeSales = await getAllActiveSales()
      if (typeof activeSales === 'undefined') {
        throw new Error("getAllActiveSales() returned undefined")
      }
      activeSales.rows.forEach((row) => {
        scanner.ActiveSalesUnderAllSa.push(row.box_id)
      })

      logger.next({ message: 'loaded active sales from database', active_sales_count: activeSales.rows.length})
    } catch(error) {
      throw error
    }
  },
  async processNewSales() {
    try {
      for (const sa of scanner.SalesAddresses) {
        logger.next({ message: "processing sales address", sales_address: `${sa.address}` })
        const utxosForSa = await getAllUtxosByAddress(logger, sa.address)
        await scanner.processUtxosUnderSa(logger, utxosForSa, sa)
      }
    } catch(error) {
      throw error
    }
  },
  async processInactiveSales() {
    const inActiveSales = await getAllInactiveSales()
    if (typeof inActiveSales !== "undefined") {
      await scanner.finaliseInactiveSales(logger, inActiveSales.rows)
    } else {
      logger.next({ message: "No Inactive Sales found" })
    }
  },
  async scannerLoop() {
    logger.next({ message: "Start of infinite sales scanner loop" })
    while (true) {
      try {
        let newBlock = await scanner.checkForNewBlock(currentHeight)
        if (newBlock) {
          logger.next({ message: 'new block found', block_height: newBlock })

          for (const sa of scanner.SalesAddresses) {
            //TODO: need method to get utxo's under sa and store in local storage, so below 2 methods don't have to do it twice. implement below too.
            // this may already be done with utxos for sa and you forgot to remove todo idk
            const utxosForSa = await getAllUtxosByAddress(logger, sa.address)

            //check mempool and address for activeSales, mark as inactive.
            await scanner.markInactiveSalesForSaOnDb(logger, utxosForSa, sa)
            // process any new utxo's
            await scanner.processUtxosUnderSa(logger, utxosForSa, sa)
          }

          //sleep to allow txs to finalise
          await sleep(scanner.POST_NEW_BLOCK_WAIT_TIME_MS)

          //check any tx's which confirmed in block
          await this.processInactiveSales()
          logger.next({ message: "inactive sales processed..." })

          logger.next({ message: "paying team..." })
          try {
              await checkBalancePayTeamWithInputLimit(scanner.NODE_MAIN_WALLET_ADDRESS)
          } catch (error) {
            logger.next({ message: "Error occured whilst trying to pay team!", level: "error", error: error})
          }
        } else {
          // should be once every 20s if blockPollRate is 1 seconds, once every 20s is blockPollrate is 10s.
          logger.next({ message: "Still alive, getting mempool utxo's"})
          //for each sales address being tracked -
          // just process new utxo's in the mempool, add to sales.

          for (const sa of scanner.SalesAddresses) {
            const utxosMem = await redundancyGetUtxosMempoolOnly(logger, sa.address);
            await scanner.processUtxosUnderSa(logger, utxosMem, sa)
          }
        }

        // wait 'blockPollRateMs' - tune with program loop duration to exec reliably?
        await sleep(SCANNER_BLOCK_POLL_RATE_MS)

      } catch (error) {
        throw error
      }
    }
  },
  finish() {
    logger.complete()
    logger = new Subject()
  },
  values() {
    return Observable.from(logger)
  },
}

export type SSWorker = typeof salesScanner

expose(salesScanner)
