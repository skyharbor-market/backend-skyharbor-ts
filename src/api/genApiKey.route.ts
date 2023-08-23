import express, { Request, Response } from "express"
import cors from "cors"
import { spawn, Thread, Worker } from 'threads'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()

const origins = ['https://skyharbor.io', 'https://www.skyharbor.io', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://testapi.skyharbor.io', 'https://api.skyharbor.io', 'https://skyharbor-git-development-enftexchange.vercel.app']
const options: cors.CorsOptions = {
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
  ],
  methods: 'GET,OPTIONS,POST',
  origin: origins,
  preflightContinue: false,
}

router.options('*', cors(options), async (req: Request, res: Response) => {
  res.status(200)
})

router.get('/test', cors(options), async (req: Request, res: Response) => {

  const uuid = uuidv4()
  const txId = req.body.txId

  try {
    const scanner = await spawn(new Worker('../workers/chainScanner'))
      ; (async () => {
        try {
          scanner.values().subscribe((log) => {
            console.log(log)
          })
          await scanner.scanChain(txId, uuid)
        } catch (err) {
          console.error('chain scanner thread errored', err, 'traceId', uuid)
        } finally {
          scanner.finish()
          await Thread.terminate(scanner)
        }
      })()
  } catch (err) {
    console.error('error creating chain scanner worker thread', err, 'traceId', uuid)
    res.status(500)
    res.send({ "traceId": uuid })
  }

  res.status(200)
  res.send({ "traceId": uuid })
})

const checkApiKey = (walletAddr: string) => {
  return "abcdef123"
}

const generateApiKey = (walletAddr: string) => {
  return "uvwxyz456"
}

function getApiKey(walletAddr: string) {
  // check if wallet address has one already otherwise generate one
  const key = checkApiKey(walletAddr)

  return key !== "" ? key : generateApiKey(walletAddr)
}

export default router