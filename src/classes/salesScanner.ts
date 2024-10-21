import * as dotenv from "dotenv"
import path from "path"
//import logger from "../logger"
import { SalesAddress } from "./salesAddress"
import { SaleBox } from "./saleBox"
import { Token } from "./token"
import { Sale } from "./sale"
import { checkTokenExistsOnDb, addTokenToDb, addOrReactivateSale, writeFinishedSaleToDb } from "../scanner/db"
import { boxByBoxId } from '../ergofunctions/explorer'

const envFilePath = path.resolve(__dirname, './.env')
dotenv.config({ path: envFilePath })

type thrower = (reason: string) => Error

export class SalesScanner {
  //globally needed config file parms
  BLOCK_POLL_RATE_MS: number
  POST_NEW_BLOCK_WAIT_TIME_MS: number
  HTTP_503_WAIT_TIME_MS: number
  INIT_BLOCK_SCAN_PERIOD: number
  NERG_TX_FEE: bigint
  API_REATTEMPTS: number
  API_REATTEMPT_DELAY_MS: number
  NODE_MAIN_WALLET_ADDRESS: string
  MAINT_ADDRESS: string
  MAINT_PERCENTAGE: number
  DECIMAL_PAY_THRESHOLD: number | thrower

  //not from config file
  MAX_TX_INPUT_LIMIT: number = 100
  MIN_NERG_TEAM_PAY_TOTAL: bigint = BigInt(1000000000)

  // holds all sales addresses to be iterated over and searched for txns.
  SalesAddresses: SalesAddress[] = []

  //global lists of active / omit sales, not sure if these are needed or can be localised to methods that use em
  ActiveSalesUnderAllSa: string[] = []
  OmittedSales: string[] = []

  // reference block height to know where scanner will start from
  currHeight: number = 1

  constructor() {
    this.BLOCK_POLL_RATE_MS = process.env.SCANNER_BLOCK_POLL_RATE_MS !== undefined ? Number(process.env.SCANNER_BLOCK_POLL_RATE_MS) : 1000
    this.POST_NEW_BLOCK_WAIT_TIME_MS = process.env.SCANNER_POST_NEW_BLOCK_WAIT_TIME_MS !== undefined ? Number(process.env.SCANNER_POST_NEW_BLOCK_WAIT_TIME_MS) : 5000
    this.HTTP_503_WAIT_TIME_MS = process.env.HTTP_503_WAIT_TIME_MS !== undefined ? Number(process.env.HTTP_503_WAIT_TIME_MS) : 60000
    this.INIT_BLOCK_SCAN_PERIOD = process.env.SCANNER_INIT_BLOCK_SCAN_PERIOD !== undefined ? Number(process.env.SCANNER_INIT_BLOCK_SCAN_PERIOD) : 100
    this.NERG_TX_FEE = process.env.SCANNER_NANO_ERG_TX_FEE !== undefined ? BigInt(process.env.SCANNER_NANO_ERG_TX_FEE) : BigInt(1000000)
    this.API_REATTEMPTS = process.env.SCANNER_API_REATTEMPTS !== undefined ? Number(process.env.SCANNER_API_REATTEMPTS) : 5
    this.API_REATTEMPT_DELAY_MS = process.env.SCANNER_REATTEMPTS_DELAY_MS !== undefined ? Number(process.env.SCANNER_REATTEMPTS_DELAY_MS) : 5
    this.NODE_MAIN_WALLET_ADDRESS = process.env.NODE_MAIN_WALLET_ADDRESS !== undefined ? process.env.NODE_MAIN_WALLET_ADDRESS : ""

    if (process.env.SCANNER_MAINT_PERCENTAGE !== undefined) {
      this.MAINT_PERCENTAGE = Number(process.env.SCANNER_MAINT_PERCENTAGE)
    } else {
      throw Error("SCANNER_MAINT_PERCENTAGE not set")
    }

    if (process.env.SCANNER_MAINT_ADDRESS !== undefined) {
      this.MAINT_ADDRESS = process.env.SCANNER_MAINT_ADDRESS
    } else {
      throw Error("SCANNER_MAINT_ADDRESS not set")
    }

    if (process.env.SCANNER_DECIMAL_PAY_THRESHOLD !== undefined) {
      this.DECIMAL_PAY_THRESHOLD = Number(process.env.SCANNER_DECIMAL_PAY_THRESHOLD)
    } else {
      throw Error("DECIMAL_PAY_THRESHOLD not set")
    }
  }

  public toString(): string {
    const obj: string = `BLOCK_POLL_RATE_MS: ${this.BLOCK_POLL_RATE_MS}` +
      `, POST_NEW_BLOCK_WAIT_TIME_MS: ${this.POST_NEW_BLOCK_WAIT_TIME_MS}` +
      `, HTTP_503_WAIT_TIME_MS: ${this.HTTP_503_WAIT_TIME_MS}` +
      `, INIT_BLOCK_SCAN_PERIOD: ${this.INIT_BLOCK_SCAN_PERIOD}` +
      `, NERG_TX_FEE: ${this.NERG_TX_FEE}` +
      `, API_REATTEMPTS: ${this.API_REATTEMPTS}` +
      `, API_REATTEMPT_DELAY_MS: ${this.API_REATTEMPT_DELAY_MS}` +
      `, NODE_MAIN_WALLET_ADDRESS: ${this.NODE_MAIN_WALLET_ADDRESS !== "" ? this.NODE_MAIN_WALLET_ADDRESS : "<empty>"}` +
      `, MAINT_PERCENTAGE: ${this.MAINT_PERCENTAGE}` +
      `, MAINT_ADDRESS: ${this.MAINT_ADDRESS}` +
      `, DECIMAL_PAY_THRESHOLD: ${this.DECIMAL_PAY_THRESHOLD}` +
      `, MAX_TX_INPUT_LIMIT: ${this.MAX_TX_INPUT_LIMIT}` +
      `, MIN_NERG_TEAM_PAY_TOTAL: ${this.MIN_NERG_TEAM_PAY_TOTAL}`
    return obj
  }

  public async processUtxosUnderSa(logger: any, utxos: any[], salesAddr: SalesAddress) {
    logger.next({ message: `processing ${utxos.length} utxo boxes for sales address ${salesAddr.address}` })
    for (const utxo of utxos) {
      // if new UTXO is not on activeSales list
      if (!this.ActiveSalesUnderAllSa.includes(utxo.boxId) && !this.OmittedSales.includes(utxo.boxId)) {
        logger.next({ message: `box with id: ${utxo.boxId} is new, processing...` })
        try {
            const sb: SaleBox = SaleBox.decodeBox(logger, utxo)
            sb.salesAddress = salesAddr
            logger.next({ message: `box id ${utxo.boxId} decoded` })
          // REMOVE
          if (utxo.boxId === "247e0772e804cee71c0870538acc22c442e6f0fa888b4d5cedc216721da783f0") {


            if (sb.validSale && sb.tokenId !== undefined) {
              // if token does not exist on db yet,
              // get token info and add token to db
              const t = await SalesScanner.processToken(logger, sb.tokenId)
              logger.next({ message: `token id ${sb.tokenId} processed` })

              if (t.valid) {
                const sale = await SalesScanner.createValidSale(logger, sb, t)
                logger.next({ message: `sale details with boxid ${sale.boxId} created` })
                // add to db under active sales
                await addOrReactivateSale(sale)
                logger.next({ message: `sale with boxid ${sale.boxId} added to db` })
                // add to activeSales list
                this.ActiveSalesUnderAllSa.push(sale.boxId!)
              } else {
                logger.next({ message: `token with id: ${t.tokenId} was invalid!` })
                this.OmittedSales.push(utxo.boxId)
              }
            } else {
              logger.next({ message: `box with id:${utxo.boxId} was not a valid sale box!` })
              this.OmittedSales.push(utxo.boxId);
            }
          }
        } catch (error) {
          logger.next({ message: `failed to decode utxo box - ${error}` })
        }
      }
    }
  }

  private static async processToken(logger: any, tokenId: string): Promise<Token> {
    const token = new Token(tokenId)

    if (await checkTokenExistsOnDb(tokenId)) {
      token.existsOnDb = true
      token.valid = true
    } else {
      token.existsOnDb = false
      await token.getInfoOnSelf(logger)

      if (token.valid) {
        logger.next({ message: `adding valid token ${tokenId} to db...` })
        const ret = await addTokenToDb(token)
        if (typeof ret !== "undefined") {
          logger.next({ message: `failed to add token ${tokenId} to db`, error: ret.message })
        } else {
          logger.next({ message: `token with id: ${tokenId} added to db!` })
        }
      } else {
        token.logInfoOnSelf(logger)
      }
      return token
    }

    return token
  }

  private static async createValidSale(logger: any, salebox: SaleBox, token: Token): Promise<Sale> {
    let sale: Sale
    if (salebox.sellerErgoTree === "") {
      sale = new Sale(salebox)
    } else {
      sale = new Sale(salebox, await Sale.WithSellerAddr(salebox.sellerErgoTree))
    }

    if (token !== null) {
      sale.addRoyaltyInfo(token)
    }

    //if sale is completed
    if (salebox.spent === true) {
      await sale.updateSaleAfterSpend(logger)
    } else {
      sale.status = "active"
    }

    return sale
  }

  public static checkForNewBlock(prevHeight: number) {

  }

  // attempts to get info on the inactive sales, writes info to db if found.
  public async finaliseInactiveSales(logger: any, inactiveSales: string[] ) {
    logger.next({ message: "attempting to finalise inactive sales..."})
    const removeInactive: string[] = []
    // check all unspent UTXO's against activeSales list
    for (const boxId of inactiveSales) {
      const box = await boxByBoxId(boxId)
      if (Object.keys(box).length > 0 || box.length > 0) {

        // TODO: we already most of the sales' info on db... got to be a better way of doing this that doesn't decode the whole sale box again
        const sb: SaleBox = SaleBox.decodeBox(logger, box)
        logger.next({ message: "inactive sales box decoded"})

        for (const sa of this.SalesAddresses) {
          if (sb.address === sa.address) {
            sb.salesAddress = sa
            // TODO: should we break here?
          }
        }

        const s: Sale = await Sale.CreateValidSale(logger, sb)
        logger.next({ message: "inactive sales details got"})

        await writeFinishedSaleToDb(s)

        removeInactive.push(boxId)
      } else {
        logger.next({ message: `could not retrieve info on inactive sale with box id: ${boxId}`})
      }
    }
  }
}
