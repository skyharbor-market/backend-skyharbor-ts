import { Explorer, Transaction } from "@coinbarn/ergo-ts"
// import { friendlyToken, getMyBids, setMyBids, showStickyMsg } from "./helpers"
import { get } from "./rest"
import { auctionAddress, auctionAddresses, auctionTrees } from "./consts"
import * as dotenv from "dotenv"
import path from "path"
// import { longToCurrency } from "./serializer"
//import logger from "../logger"

const envFilePath = path.resolve(process.cwd(), './.env')
dotenv.config({ path: envFilePath })

const HTTP_503_WAIT_TIME_MS = Number(process.env.HTTP_503_WAIT_TIME_MS) || 60000

const explorer = Explorer.mainnet;
export const explorerApi = 'https://api.ergoplatform.com/api/v0'
export const explorerApiV1 = 'https://api.ergoplatform.com/api/v1'


const sleep = async (durationMs: number) => {
  return new Promise(resolve => setTimeout(resolve, durationMs));
}

export async function getRequest(url: any, api = explorerApiV1) {
  return await get(api + url)
}

export async function currentHeight() {
  return getRequest('/blocks?limit=1')
    .then(res => {
      return res.items[0].height
    })
}

export async function currentBlock() {
  return getRequest('/blocks?limit=1')
    .then(res => {
      return res.items[0]
    })
}

export async function getLastHeaders() {
  return getRequest('/blocks/headers?limit=10')
    .then(res => {
      return res.items
    })
}

export function unspentBoxesFor(address: any) {
  return getRequest(`/transactions/boxes/byAddress/unspent/${address}`)
}

export async function unspentBoxesForV1(address: any, offset = "0", limit = "50") {
  return getRequest(
    `/boxes/unspent/byAddress/${address}?offset=${offset}&limit=${limit}`, explorerApiV1
  ).then((res) => res.items
  ).catch(err => {
    throw err
  })
}

export async function getAllUtxosByAddress(logger: any, address: string): Promise<any[]> {
  let offset = 0
  let limit = 500
  let utxos: any[] = []
  // get all unspent UTXOs
  for (; ;) {
    try {
      const batch = await unspentBoxesForV1(address, offset.toString(), limit.toString())
      if (batch.length > 0) {
        utxos = utxos.concat(batch)
        offset += limit
      } else {
        break
      }
    } catch (err) {
      // TODO: implement retry count
      if (err.message === "Response status: 503") {
        // delay retry
        logger.next({ message: `external API call returned status 503 delaying retry for ${HTTP_503_WAIT_TIME_MS}ms`, explorer_endpoint: address })
        await sleep(HTTP_503_WAIT_TIME_MS)
        continue
      } else {
        break
      }
    }
  }

  // reset batch offsets
  offset = 0
  limit = 500
  // inc. mempool
  for (; ;) {
    try {
      const batch = await getUnconfirmedTxsFor(address, offset.toString(), limit.toString())
      if (batch.length > 0) {
        utxos = utxos.concat(batch)
        offset += limit
      } else {
        break
      }
    } catch (err) {
      // TODO: implement retry count
      if (err.message === "Response status: 503") {
        // delay retry
        logger.next({ message: `external API call returned status 503 delaying retry for ${HTTP_503_WAIT_TIME_MS}ms`, explorer_endpoint: address })
        await sleep(HTTP_503_WAIT_TIME_MS)
        continue
      } else {
        break
      }
    }
  }

  return utxos
}

export async function redundancyGetUtxosMempoolOnly(logger: any, address: string): Promise<any[]> {
  let offset = 0
  let limit = 500
  let utxos: any[] = []
  // get all unconfirmed UTXOs from mempool

  for (; ;) {
    try {
      const batch = await getUnconfirmedTxsFor(address, offset.toString(), limit.toString())
      if (batch.length > 0) {
        utxos = utxos.concat(batch)
        offset += limit
      } else {
        break
      }
    } catch (err) {
      // TODO: implement retry count
      if (err.message === "Response status: 503") {
        // delay retry
        logger.next({ message: `external API call returned status 503 delaying retry for ${HTTP_503_WAIT_TIME_MS}ms`, explorer_endpoint: address })
        await sleep(HTTP_503_WAIT_TIME_MS)
        continue
      } else {
        break
      }
    }
  }

  return utxos
}

export function getBoxesForAsset(asset: any) {
  return getRequest(`/boxes/unspent/byTokenId/${asset}`, explorerApiV1)
}

export function getActiveAuctions(addr: any) {
  return getRequest(`/boxes/unspent/byAddress/${addr}?limit=500`, explorerApiV1)
    .then(res => res.items)
    .then((boxes) => boxes.filter((box: any) => box.assets.length > 0));
}

export async function getUnconfirmedTxsFor(addr: any, offset = "0", limit = "50") {
  return getRequest(
    `/mempool/transactions/byAddress/${addr}?offset=${offset}&limit=${limit}`, explorerApiV1
  ).then((res) => res.items
  ).catch(err => {
    throw err
  })
}

export async function getTokenBoxV1(tokenId: any) {
  return getRequest(`/tokens/${tokenId}`, explorerApiV1)
}

export async function getAllActiveAuctions() {
  const spending = (await getUnconfirmedTxsFor(auctionAddress)).filter((s: any) => s.inputs.length > 1)
  let idToNew: any = {}
  spending.forEach((s: any) => {
    let curId = s.inputs[s.inputs.length - 1].boxId
    if (idToNew[curId] === undefined || idToNew[curId].value < s.value)
      idToNew[curId] = s.outputs[0]
  })
  const all = auctionAddresses.map((addr) => getActiveAuctions(addr));
  return Promise.all(all)
    .then((res) => [].concat.apply([], res))
    .then(res => {
      return res.map((r: any) => {
        if (idToNew[r.boxId] !== undefined) return idToNew[r.boxId]
        else return r
      })
    })
}

export function getAuctionHistory(limit: any, offset: any, auctionAddr: any) {
  return getRequest(
    `/addresses/${auctionAddr}/transactions?limit=${limit}&offset=${offset}`, explorerApiV1
  )
    .then((res) => res.items);
}

export async function getCompleteAuctionHistory(limit: any, offset: any) {
  let allHistory = auctionAddresses.map(addr => getAuctionHistory(limit, offset, addr))
  return Promise.all(allHistory)
    .then(res => [].concat.apply([], res))
    .then(res => {
      res.sort((a: any, b: any) => b.timestamp - a.timestamp)
      return res
    })
}

export function boxByAddress(id: any) {
  return getRequest(`/transactions/boxes/${id}`)
}

export function boxById(id: any) {
  return getRequest(`/transactions/boxes/${id}`)
}

export async function boxByBoxId(id: any) {
  return getRequest(`/boxes/${id}`, explorerApiV1)
}

export async function followAuction(id: any) {
  let cur = await getRequest(`/boxes/${id}`, explorerApiV1)
  if (!cur.id) cur.id = cur.boxId
  while (cur.spentTransactionId) {
    let new_cur = (await txById(cur.spentTransactionId)).outputs[0]
    if (new_cur.address === auctionAddress)
      cur = new_cur
    else break
  }
  return cur
}

export async function txByAddress(addr: any) {
  return getRequest(`/addresses/${addr}/transactions`)
    .then((res) => res.items);
}

export async function txById(id: any) {
  return getRequest(`/transactions/${id}`, explorerApiV1)
}

export async function getSpendingTx(boxId: any) {
  const data = getRequest(`/transactions/boxes/${boxId}`);
  return data
    .then((res) => res.spentTransactionId)
    .catch((_) => null);
}

export async function getIssuingBox(tokenId: any) {
  const data = getRequest(`/assets/${tokenId}/issuingBox`);
  return data
    .catch((_) => null);
}

export function sendTx(tx: any) {
  explorer.broadcastTx(tx);
}

export async function getBalance(addr: any) {
  return getRequest(`/addresses/${addr}/balance/confirmed`, explorerApiV1);
}
function res(res: any, arg1: (unknown: any) => any) {
  throw new Error("Function not implemented.");
}
