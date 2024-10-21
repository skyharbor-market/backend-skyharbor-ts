import { Observable, Subject } from "threads/observable"
import { expose } from "threads/worker"
import { SalesScanner } from "../classes/salesScanner"
import {
  getCurrentBlockHeight,
  getMainWalletAddress } from "../ergofunctions/node"
import { getAllUtxosByAddress } from "../ergofunctions/explorer"
import { NODE_BASE_URL } from "../consts/salesScanner"
import {
  getActiveSalesAddresses,
  deactivateSalesNotOnActiveAddresses,
  reactivateSalesOnActiveAddresses,
  getAllActiveSales,
  getAllInactiveSales } from "../scanner/db"
import { SalesAddress } from "../classes/salesAddress"

const sleep = async (durationMs: number) => {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}

const scanner = new SalesScanner()
let logger = new Subject()

const salesScanner = {
  async init() {
    try {
      // loop to check if ergo node is up
      let currentHeight: number = await getCurrentBlockHeight()
      while (currentHeight === 0) {
        logger.next({ message: `cannot communicate with ergo node, retrying in 10 seconds - NODE_BASE_URL: ${NODE_BASE_URL}` })
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

      logger.next({ message: `${salesAddrs.rows.length} active sales addresses loaded` })
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

      logger.next({ message: `successfully added ${activeSales.rows.length} active sales from database` })
    } catch(error) {
      throw error
    }
  },
  async processNewSales() {
    try {
      for (const sa of scanner.SalesAddresses) {
        logger.next(`processing sales address ${sa.address}`)
        const utxosForSa = await getAllUtxosByAddress(logger, sa.address)
        await scanner.processUtxosUnderSa(logger, utxosForSa, sa)
      }
      // This is for testing a single SalesAddress
      // logger.next({ message: `processing sales address ${scanner.SalesAddresses[2].address}` })
      // const utxosForSa = await getAllUtxosByAddress(logger, scanner.SalesAddresses[2].address)
      // await scanner.processUtxosUnderSa(logger, utxosForSa, scanner.SalesAddresses[2])
    } catch(error) {
      throw error
    }
  },
  async processInactiveSales() {
    const inActiveSales = await getAllInactiveSales()
    if (typeof inActiveSales !== "undefined") {
      // TODO: finish this function
      await scanner.finaliseInactiveSales(logger, inActiveSales.rows)
    } else {

    }
  },
  async scannerLoop() {
    // TODO: Complete sales scanner infinite loop workflow
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
