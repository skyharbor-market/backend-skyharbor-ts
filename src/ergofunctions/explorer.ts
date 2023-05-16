import { Explorer, Transaction } from "@coinbarn/ergo-ts"
// import { friendlyToken, getMyBids, setMyBids, showStickyMsg } from "./helpers"
import { get } from "./rest"
import { auctionAddress, auctionAddresses, auctionTrees } from "./consts"
// import { longToCurrency } from "./serializer"

const explorer = Explorer.mainnet;
export const explorerApi = 'https://api.ergoplatform.com/api/v0'
export const explorerApiV1 = 'https://api.ergoplatform.com/api/v1'

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

export function getBoxesForAsset(asset: any) {
  return getRequest(`/boxes/unspent/byTokenId/${asset}`, explorerApiV1)
}

export function getActiveAuctions(addr: any) {
  return getRequest(`/boxes/unspent/byAddress/${addr}?limit=500`, explorerApiV1)
    .then(res => res.items)
    .then((boxes) => boxes.filter((box: any) => box.assets.length > 0));
}

export function getUnconfirmedTxsFor(addr: any) {
  return getRequest(
    `/mempool/transactions/byAddress/${addr}`, explorerApiV1
  )
    .then((res) => res.items);
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

export function txByAddress(addr: any) {
  return getRequest(`/addresses/${addr}/transactions`)
    .then((res) => res.items);
}

export function txById(id: any) {
  return getRequest(`/transactions/${id}`)
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

