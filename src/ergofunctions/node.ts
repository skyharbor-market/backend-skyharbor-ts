import { get, post } from "./rest"
import * as dotenv from "dotenv"
import path from "path"
import logger from '../logger'

// in order to secure the node requests (port 9053) the following setting have been done on apache
// prevent any connection to 9053 except from localhost
// proxy https://transaction-builder.ergo.ga/blocks to http://localhost:9053/blocks/lastHeaders/10

const envFilePath = path.resolve(process.cwd(), './.env')
dotenv.config({ path: envFilePath })

const NODE_BASE_URL = process.env.NODE_BASE_URL || "http://localhost:9053"
const NODE_API_KEY = process.env.NODE_API_KEY || ""
const NODE_WALLET_PASS = process.env.NODE_WALLET_PASS || ""

async function getRequest(url: any, apiKey = '') {
    try {
      const res = await get(NODE_BASE_URL + url, apiKey)
      return { data: res }
    } catch(e) {
      logger.error({ message: "node rest get request failed", url: url, error: e})
      return { data: e }
    }
}

async function postRequest(url: any, body = {}, apiKey = '') {
    try {
      const res = await post(NODE_BASE_URL + url, body, apiKey)
      return { data: res }
    } catch(e) {
      logger.error({ message: "node rest post request failed", body: body, url: url, error: e})
      return { data: e }
    }
}

export async function getLastHeaders() {
    return await getRequest('/blocks/lastHeaders/10')
      .then(res => res.data)
}

export async function getCurrentBlockHeight(): Promise<number> {
  const head = await getRequest('/blocks/lastHeaders/1')
  if (head.data.length > 0) {
    if (head.data[0].hasOwnProperty("height")) {
      return Number(head.data[0].height)
    }
  }
  return 0
}

export async function getMainWalletAddress(): Promise<string | Error> {
  const addr = await getRequest('/wallet/addresses', NODE_API_KEY)
  // error occurred
  if (addr.data.hasOwnProperty("error")) {
    return new Error(JSON.stringify(addr.data))
  } else if (addr.data.length > 0) {
      return addr.data[0]
  }
  return ""
}

export async function getConfirmedBalance(): Promise<number | Error> {
  const balance = await getRequest('/wallet/balances', NODE_API_KEY)

  if (balance.data.hasOwnProperty("error")) {
    return new Error(JSON.stringify(balance.data.reason))
  } else if (balance.data.hasOwnProperty("balance")) {
      return Number(balance.data.balance)
  }
  return 0
}

export async function getUnspentUtxos(minConfirmations: number, minInclusionHeight: number): Promise<any[] | Error> {
  const utxos = await getRequest(`/wallet/boxes/unspent?minConfirmations=${minConfirmations}&minInclusionHeight=${minInclusionHeight}`, NODE_API_KEY)

  if (utxos.data.hasOwnProperty("error")) {
    return new Error(JSON.stringify(utxos.data.reason))
  } else if (utxos.data.length > 0) {
      return utxos.data
  }
  return []
}

export async function unlockWallet(): Promise<string | Error> {
  const body = {
    pass: NODE_WALLET_PASS
  }

  const resp = await postRequest('/wallet/unlock', body, NODE_API_KEY)

  if (resp.data.hasOwnProperty("error")) {
    return new Error(JSON.stringify(resp.data.reason))
  }

  return ""
}

export async function lockWallet(): Promise<string | Error> {
  const resp = await getRequest('/wallet/lock', NODE_API_KEY)

  if (resp.data.hasOwnProperty("error")) {
    return new Error(JSON.stringify(resp.data.reason))
  }
  return ""
}

export async function getBoxBinaryMempool(boxId: string): Promise<any | Error> {
  const resp = await getRequest(`/utxo/withPool/byIdBinary/${boxId}`, NODE_API_KEY)

  if (resp.data.hasOwnProperty("error")) {
    if (resp.data.error === 404) {
      return new Error("box id not found")
    } else {
      return new Error(JSON.stringify(resp.data.reason))
    }
  }

  return resp.data
}

export async function generateTransaction(body: any): Promise<any | Error> {
  const resp = await postRequest('/wallet/transaction/generate', body, NODE_API_KEY)

  // parse json body
  const txBody = await resp.data.json()

  if (txBody.hasOwnProperty("error")) {
    return new Error(JSON.stringify(txBody.error.reason))
  }

  return txBody
}

export async function sendTransaction(body: any): Promise<any | Error> {
  const resp = await postRequest('/wallet/transaction/send', body, NODE_API_KEY)

  // parse json body for tx Id
  const txId = await resp.data.json()

  if (txId.hasOwnProperty("error")) {
    return new Error(JSON.stringify(txId.error.reason))
  }

  return txId
}

export async function redundancyGetConfirmedUtxosByAddress(address: string): Promise<any[]> {
  let offset = 0
  let limit = 500
  let utxos: any[] = []
  let url = ""

  // continuously call node api until we have gotten all utxos
  for (; ;) {
    url = `/blockchain/box/byAddress?limit=${limit.toString()}&offset=${offset.toString()}`
    const payload = `"${address}"`
    const batch = await postRequest(url, payload)
      .then(resp => {
        if (resp.data.hasOwnProperty("items") && resp.data["items"].length > 0) {
          return resp.data["items"]
        }
        return []
      })
      .catch(err => {
        throw err
      });
    if (batch.length !== 0) {
      utxos = utxos.concat(batch)
    } else {
      return utxos
    }

    offset += limit
  }
}

export async function redundancyGetUtxosMempoolOnly(address: string): Promise<any[]> {
  let offset = 0
  let limit = 500
  let utxos: any[] = []
  let url = ""

  // continuously call node api until we have gotten all utxos
  for (; ;) {
    url = `/transactions/unconfirmed?limit=${limit.toString()}&offset=${offset.toString()}`
    const batch = await getRequest(url)
      .then(resp => {
        if (resp.data.length > 0) {
          return resp.data
        }
        return []
      })
      .catch(err => {
        throw err
      });
    if (batch.length !== 0) {
      logger.info({ message: "utxo batch received", batch: batch })
      // TODO: parse through output and only return utxos with address if possible
      //utxos = utxos.concat(batch)
    } else {
      return utxos
    }

    offset += limit
  }
}

export async function sendTx(json: any) {
    const res = await postRequest('/transactions', json);
    return res.data;
}
