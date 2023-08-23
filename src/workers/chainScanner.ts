import { Observable, Subject } from 'threads/observable'
import { expose } from 'threads/worker'

const sleep = async (durationMs: number) => {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}

const checkApiKey = (walletAddr: string) => {
  return "abcdef123"
}

const generateApiKey = (walletAddr: string) => {
  return "uvwxyz456"
}

let subject = new Subject()

const chainScanner = {
  async scanChain(txId: string, traceId: string) {
    for (var i = 0; i < 2; i++) {
      subject.next(`scanning blockchain for tx - traceId=${traceId}`)
      // sleep 1 min
      await sleep(2000)
    }
    // tx found return it
    return {
      "txId": "1234567890",
      "r4": "a1b2c3d4", //sender wallet address
    }

  },
  getApiKey(walletAddr: string) {
    // check if wallet address has one already otherwise generate one
    const key = checkApiKey(walletAddr)

    return key !== "" ? key : generateApiKey(walletAddr)
  },
  finish() {
    subject.complete()
    subject = new Subject()
  },
  values() {
    return Observable.from(subject)
  },
}

expose(chainScanner)