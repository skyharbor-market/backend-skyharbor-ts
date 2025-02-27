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

const envFilePath = path.resolve(process.cwd(), './.env')
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

  logger.info({ message: "processing team payment txs", component: "sales-scanner", erg_total: origPayAmount })
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

  logger.info({ message: "paying team and maintenance amount after fee and saving-for-future-tx's", component: "sales-scanner", erg_pay_amount: payAmount})

  const maintPay: number = (SCANNER_MAINT_PERCENTAGE / 100) * payAmount
  const maintPayment = new PaymentData(SCANNER_MAINT_ADDRESS, maintPay)

  logger.info({ message:"paying team wallet", component: "sales-scanner", wallet_address: SCANNER_MAINT_ADDRESS, erg_maint_amount: maintPay })
  let totalToSend: number = maintPay

  awaitingPayments.push(maintPayment)

  //maintenanceLevy
  const teamPayAmount: number = payAmount - maintPay

  for (const teamMember of paySplit) {
    const walletAddr: string = teamMember.wallet
    const percentage: number = teamMember.splitPercentage

    // Math.floor will discard any fractional part, effectively rounding down
    const indivPay = Math.floor((percentage / 100) * teamPayAmount)

    logger.info({ message: "paying team member", component: "sales-scanner", wallet_address: walletAddr, percentage: percentage, erg_amount: indivPay })

    totalToSend = totalToSend + indivPay
    const teamPayment = new PaymentData(walletAddr, indivPay)

    //insert team payments at the start of the array, so they are read off first and refunds after.
    awaitingPayments.push(teamPayment)
  }

  logger.info({ message: `original team and maintenance pay amount`, component: "sales-scanner", erg_total_amount: payAmount, erg_total_sent: totalToSend })
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
    logger.error({ message: "could not successfully add inputs to tx body, cancelling team pay..", component: "sales-scanner" })
    return
  }

  logger.info({ message: "generating tx to pay team", component: "sales-scanner", body: body })

  const txPayload = await generateTransaction(body)

  if (txPayload.hasOwnProperty("error")) {
    logger.error({ message: "failed to generate tx from node", component: "sales-scanner", error: txPayload })
    return
  }

  // clear down the arrays of sales, payments
  // team accumulated pay DOES NOT need be cleared down as it is properly scoped to this method.
  // REMOVED the clear down of the array, AS THE BATCHED TOKEN / PAYMENTS need to be retained between loops.
  // CLEARED DOWN HERE as the node request is recorded, so those tokens / payments should be considered sent even if sending issue.
  let finalTotal = feeAmount

  for (const p of awaitingPayments) {
    finalTotal = finalTotal + p.nanoErgAmount
  }

  logger.info({ message: "sending transaction to pay team", component: "sales-scanner", erg_orig_amount: origPayAmount, erg_final_total: finalTotal, tx_payload: txPayload })

  if (process.env.NODE_ENV === 'production') {
    const txResp = await sendTransaction(txPayload)
    if (txResp.hasOwnProperty("error")) {
      logger.error({ message: "Send tx failed!", component: "sales-scanner", error: txResp })
    } else {
      logger.info({ message: "Team pay tx was successful!", component: "sales-scanner", tx_id: txResp})
    }
  }
}

export async function checkBalancePayTeamWithInputLimit(nodeMainWalletAddr: string): Promise<void> {
  let walletBalance: number | Error = 0
  try {
    walletBalance = await getConfirmedBalance()
  } catch(e) {
    logger.error({ message: "Error occurred while checking balance", component: "sales-scanner", error: e })
  }

  if (typeof walletBalance === "number") {
    logger.info({ message: "wallet balance", component: "sales-scanner", balance: walletBalance })
    if (walletBalance > SCANNER_DECIMAL_PAY_THRESHOLD) {

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
                  logger.info({ message: "box contains assets! cannot send", component: "sales-scanner", box_id: box.boxId, asset_count: box.assets.length })
                }
              } else {
                logger.info({ message: "assets property is missing from box", component: "sales-scanner" })
              }
            }
          }

          if (balance > MIN_NERG_TEAM_PAY_TOTAL) {
            const unlock = await unlockWallet()
            if (typeof unlock !== "string") {
              logger.error({ message: "failed to unlock wallet", component: "sales-scanner", error: unlock.message })
              return
            }

            await payTeam(balance, boxIds, nodeMainWalletAddr)

            const lock = await lockWallet()
            if (typeof lock !== "string") {
              logger.error({ message: "failed to lock wallet", component: "sales-scanner", error: lock.message })
            }
          } else {
            logger.info({
              message: "The utxos remaining have balance which is lower than minimum not sending..",
              component: "sales-scanner",
              utxos_length: boxIds.length,
              erg_balance: balance,
              erg_min_team_pay_total: MIN_NERG_TEAM_PAY_TOTAL })
          }

          unspentUtxos = unspentUtxos.filter((utxo) => {
            !slicedUtxos.includes(utxo)
          })
        }

      } else {
        logger.error({ message: "Could not successfully get utxo's from node!", component: "sales-scanner", error: unspentUtxos.message })
      }
    } else {
      logger.info({
        message: "balance is below decimal pay threshold, not sending funds",
        component: "sales-scanner",
        team_wallet_balance: walletBalance,
        scanner_decimal_pay_threshold: SCANNER_DECIMAL_PAY_THRESHOLD })
    }
  } else {
    logger.error({ message: "Could not successfully get balance from node!", component: "sales-scanner", error: walletBalance.message })
  }

}
