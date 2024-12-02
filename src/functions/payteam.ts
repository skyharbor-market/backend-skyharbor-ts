import logger from '../logger'
import {
  getConfirmedBalance,
  getUnspentUtxos,
  unlockWallet,
  lockWallet,
  getBoxBinaryMempool,
  generateTransaction,
  sendTransaction
} from "../ergofunctions/node"
import { PaymentData } from "../classes/paymentData"
import { paySplit } from "../consts/salesScanner"
import * as dotenv from "dotenv"
import path from "path"

const envFilePath = path.resolve(__dirname, './.env')
dotenv.config({ path: envFilePath })

const SCANNER_DECIMAL_PAY_THRESHOLD = Number(process.env.SCANNER_DECIMAL_PAY_THRESHOLD) || 10
const SCANNER_NANO_ERG_TX_FEE = Number(process.env.SCANNER_NANO_ERG_TX_FEE) || 1000000
const SCANNER_MAINT_PERCENTAGE = Number(process.env.SCANNER_MAINT_PERCENTAGE) || 20
const SCANNER_MAINT_ADDRESS = process.env.SCANNER_MAINT_ADDRESS || ""
const MAX_TX_INPUT_LIMIT = 100
const MIN_NERG_TEAM_PAY_TOTAL = 1000000000

function getSlicedJsonArray(orig: any[], start: number, numToSlice: number): any[] {
  const sliced: any[] = []
  const origSize: number = orig.length

  if (numToSlice > origSize) {
    numToSlice = origSize
  }

  for (let i = 0; i < numToSlice; i++) {
    sliced.push(orig[start+i])
  }

  return sliced
}

async function addInputsToTxBody(body: any, inputs: string[]): Promise<any> {
  const inputsRaw: any[] = []

  for (const i of inputs) {
    const resp = await getBoxBinaryMempool(i)
    if (resp.hasOwnProperty("bytes")) {
      inputsRaw.push(resp.bytes)
    } else {
      return null
    }
  }

  body.inputsRaw = inputsRaw
  return body
}

/*
// get total amt to pay
100
// reduce fee 1
99
// reduce saving 3
96
// take the maintenance cut 35
61
split equally by 3
remainder 1

outs:
fee 1
maint 35
1 20
2 20
3 20
change 4 (remainder plus fee)
*/
async function payTeam(origPayAmount: number, inputs: string[], nodeMainWalletAddr: string) {

  logger.info({ message: `processing team payment txs with total: ${origPayAmount} ERG...` })
  let payAmount: number = origPayAmount

  // take some erg for fee payment
  const feeAmount: number = SCANNER_NANO_ERG_TX_FEE * 10
  payAmount = payAmount - feeAmount

  // take some erg for future tx's if necessary.
  const savingForFutureTxs = SCANNER_NANO_ERG_TX_FEE * 100
  payAmount = payAmount - savingForFutureTxs

  const awaitingPayments: PaymentData[] = []
  const requestArray: any[] = []
  const body: { [k: string]: any } = {}

  logger.info({ message: `paying team and maintenance for: ${payAmount} ERG, after fee and saving-for-future-tx's`})

  const maintPay: number = (SCANNER_MAINT_PERCENTAGE / 100) * payAmount
  const maintPayment = new PaymentData(SCANNER_MAINT_ADDRESS, maintPay)

  logger.info({ message: `paying team wallet ${SCANNER_MAINT_ADDRESS} ${maintPay} ERGs` })
  let totalToSend: number = maintPay

  awaitingPayments.push(maintPayment)

  //maintenanceLevy
  const teamPayAmount: number = payAmount - maintPay

  for (const teamMember of paySplit) {
    const walletAddr: string = teamMember.wallet
    const percentage: number = teamMember.splitPercentage

    // Math.floor will discard any fractional part, effectively rounding down
    const indivPay = Math.floor((percentage / 100) * teamPayAmount)

    logger.info({ message: `paying team member address: ${walletAddr} the percentage: ${percentage} - ${indivPay} ERGs` })

    totalToSend = totalToSend + indivPay
    const teamPayment = new PaymentData(walletAddr, indivPay)

    //insert team payments at the start of the array, so they are read off first and refunds after.
    awaitingPayments.push(teamPayment)
  }

  logger.info({ message: `original team and maintenance pay amount was: ${payAmount} total after division is: ${totalToSend}`})
  const remainder: number = payAmount - totalToSend

  // need to manually create a change and fee box.
  // Add change
  const changePayment = new PaymentData(nodeMainWalletAddr, 0)
  changePayment.nanoErgAmount = savingForFutureTxs + remainder

  awaitingPayments.push(changePayment)

  for (const payment of awaitingPayments) {
    var req: { [k: string]: any } = {}

    req.address = payment.address
    req.value = payment.nanoErgAmount

    requestArray.push(req)
  }

  //add requests field
  body.requests = requestArray

  // add fee field
  body.fee = feeAmount

  const resp = await addInputsToTxBody(body, inputs)
  if (resp === null) {
    logger.error({ message: "could not successfully add inputs to tx body, cancelling team pay.." })
    return
  }

  // gen transaction
  const gen = await generateTransaction(body)
  if (typeof gen !== "number") {
    logger.error({ message: "failed to generate tx from node", error: gen.message})
    return
  }

  // clear down the arrays of sales, payments
  // team accumulated pay DOES NOT need be cleared down as it is properly scoped to this method.
  // REMOVED the clear down of the array, AS THE BATCHED TOKEN / PAYMENTS need to be retained between loops.
  // CLEARED DOWN HERE as the node request is recorded, so those tokens / payments should be considered sent even if sending issue.
  logger.info({ message: `ORIGINAL PAY AMOUNT: ${origPayAmount}` })
  let finalTotal = feeAmount

  for (const p of awaitingPayments) {
    finalTotal = finalTotal + p.nanoErgAmount
  }

  logger.info({ message: `accumulated PAY AMOUNT: ${finalTotal}`})
  //print generated tx
  logger.info({ message: `gen resp code: ${gen}`})

  if (gen === 200) {
    logger.info({ message: "sending transaction..."})
    logger.info({ message: `${body}`})

    const txResp = await sendTransaction(body)
    if (typeof txResp === "string") {
      logger.info({ message: `Team pay tx: ${txResp} was successful!`})
    } else {
      logger.error({ message: `Send tx failed!`})
    }

  }
}

export async function checkBalancePayTeamWithInputLimit(nodeMainWalletAddr: string): Promise<void> {
  const walletBalance = await getConfirmedBalance()

  if (typeof walletBalance === "number") {
    if (walletBalance > SCANNER_DECIMAL_PAY_THRESHOLD) {

      const unlock = await unlockWallet()
      if (typeof unlock !== "string") {
        logger.error({ message: "failed to unlock wallet", error: unlock.message })
        return
      }

      logger.info({ message: "node wallet successfully unlocked" })

      let unspentUtxos = await getUnspentUtxos(-1,0)

      if (Array.isArray(unspentUtxos)) {
        while (unspentUtxos.length > 0) {
          const slicedUtxos = getSlicedJsonArray(unspentUtxos, 0, MAX_TX_INPUT_LIMIT)

          const boxIds: string[] = []
          let balance: number = 0

          for (const u of slicedUtxos) {
            if (u.hasOwnProperty("box")) {
              const box = u.box
              // BURN PROTECTION: only add boxes to send if they contain no assets
              if (box.hasOwnProperty("assets")) {
                if (box.assets.length === 0) {
                  boxIds.push(box.boxId)
                  balance = balance + Number(box.value)
                } else {
                  logger.info({ message: `box with id: ${box.boxId} contains ${box.assets.length} assets! cannot send` })
                }
              } else {
                logger.info({ message: "assets property is missing from box" })
              }
            }
          }

          if (balance > MIN_NERG_TEAM_PAY_TOTAL) {
            payTeam(balance, boxIds, nodeMainWalletAddr)
          } else {
            logger.info({ message: `The ${boxIds.length} utxo's remaining have balance: ${balance} which is lower than minimum of: ${MIN_NERG_TEAM_PAY_TOTAL} not sending..` })
          }

          unspentUtxos = unspentUtxos.filter((utxo) => {
            !slicedUtxos.includes(utxo)
          })
        }

        const lock = await lockWallet()
        if (typeof lock !== "string") {
          logger.error({ message: "failed to lock wallet", error: lock.message })
        } else {
          logger.info({ message: "wallet locked successfully" })
        }

      } else {
        logger.error({ message: "Could not successfully get utxo's from node!", error: unspentUtxos.message })
      }
    } else {
      logger.info({ message: `balance of '${walletBalance}' is below decimal pay threshold of '${SCANNER_DECIMAL_PAY_THRESHOLD}', not sending funds`})
    }
  } else {
    logger.error({ message: "Could not successfully get balance from node!", error: walletBalance.message })
  }

}
