import { NODE_BASE_URL, NODE_API_KEY } from "../consts/salesScanner"
import { get, post } from "./rest"

// in order to secure the node requests (port 9053) the following setting have been done on apache
// prevent any connection to 9053 except from localhost
// proxy https://transaction-builder.ergo.ga/blocks to http://localhost:9053/blocks/lastHeaders/10

async function getRequest(url: any, apiKey = '') {
    return await get(NODE_BASE_URL + url, apiKey).then(res => {
        return { data: res };
    });
}

async function postRequest(url: any, body = {}, apiKey = '') {
    try {
        const res = await post(NODE_BASE_URL + url, body, apiKey)
        return { data: res };
    } catch(e) {
        console.log("postRequest", e);
        return { data: e }
    }
}

export async function getLastHeaders() {
    return await getRequest('/blocks/lastHeaders/10')
        .then(res => res.data);
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
      console.log(JSON.stringify(batch))
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
