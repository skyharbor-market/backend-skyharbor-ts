import express, { Request, Response } from 'express'
import cors from 'cors'
import logger from '../logger'
import { spawn, Thread, Worker } from 'threads'
import { v4 as uuidv4 } from 'uuid'
import {
  checkKeyPrefix,
  saveApiKey,
  setTokenPlanLimits,
  getTokenPlanLimits,
  deleteTokenPlanLimits,
  getApiKeyByUser,
  getApiUser,
  getTierPlan,
  KeyLimit
} from './utils/db'
import { apiTiers } from '../middlewares/rateLimiterPg'
import { blake2s } from '@noble/hashes/blake2s'
import generateApiKey, { ApiKeyResults } from 'generate-api-key'
import * as dotenv from "dotenv"
import path from "path"
import Stripe from "stripe"

const envFilePath = path.resolve(process.cwd(), './.env')
dotenv.config({ path: envFilePath })
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-08-16',
  typescript: true,
})

const router = express.Router()

const origins = ['https://skyharbor.io', 'https://www.skyharbor.io', 'https://v1.skyharbor.io' ,'https://www.v1.skyharbor.io', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://testapi.skyharbor.io', 'https://api.skyharbor.io', 'https://skyharbor-git-development-enftexchange.vercel.app']
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
  res.sendStatus(200)
})

// router.get('/test', cors(options), async (req: Request, res: Response) => {

//   const uuid = uuidv4()
//   const txId = req.body.txId

//   try {
//     const scanner = await spawn(new Worker('../workers/chainScanner'))
//       ; (async () => {
//         try {
//           scanner.values().subscribe((log) => {
//             console.log(log)
//           })
//           await scanner.scanChain(txId, uuid)
//         } catch (err) {
//           console.error('chain scanner thread errored', err, 'trace_id', uuid)
//         } finally {
//           scanner.finish()
//           await Thread.terminate(scanner)
//         }
//       })()
//   } catch (err) {
//     console.error('error creating chain scanner worker thread', err, 'trace_id', uuid)
//     res.status(500).send({ "trace_id": uuid })
//     return
//   }

//   res.status(200)
//   res.send({ "trace_id": uuid })
// })

router.post('/generate', cors(options), async (req: Request, res: Response) => {

  const uuid = uuidv4()
  // TODO: get logged in user from oauth2
  const user = req.body.user || "test-user"

  // grab existing api key and key limits from user if it exists
  const oldKey = await getApiKeyByUser(user)
  let oldLimits: KeyLimit[] | undefined = undefined
  if (typeof oldKey !== "undefined") {
    oldLimits = await getTokenPlanLimits(oldKey.hash)
  }

  // generate an api prefix (salt) so we can reference it in the DB
  let pfix: ApiKeyResults = ""
  let newPrefix: number | boolean = false
  while (!newPrefix) {
    pfix = generateApiKey({ method: 'string', length: 8, pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" })
    newPrefix = await checkKeyPrefix(pfix.toString())
    if (typeof newPrefix === 'number') {
      return res.status(newPrefix).send({ "trace_id": uuid, "error": "generate api key called failed - couldn't generate prefix" })
    }
  }

  // generate api key and assign/update it to users account
  const key = generateApiKey({ method: 'string', prefix: pfix.toString(), length: 32 })
  const b2params = { salt: pfix.toString(), dkLen: 32 }
  const hash = blake2s(key.toString(), b2params)
  const decodedHash = Buffer.from(hash).toString('hex')

  // check if user has an active subscription, otherwise it's free tier
  const usr = await getApiUser(user)
  let sub: Stripe.Response<Stripe.Subscription>
  let plan: Stripe.Plan
  let tierPlan: string = "free"
  if (typeof usr !== "undefined") {
    if (usr.stripeSubscriptionId != null) {
      sub = await stripe.subscriptions.retrieve(usr.stripeSubscriptionId)
      if (sub.status === "active") {
        plan = sub.items.data[0].plan
        tierPlan = await getTierPlan(plan.id)
      }
    }
  } else {
    return res.status(500).send({ "trace_id": uuid, "error": "user not found" })
  }

  // store the hashed version of the generated key in our DB, using the prefix as an ID as well as part of the salt
  const apiSave = await saveApiKey(decodedHash, pfix.toString(), user, tierPlan)
  if (!apiSave) {
    return res.status(500).send({ "trace_id": uuid, "error": "failed to save the hashed api key to our db" })
  }

  // prime the key_limits rows for the hash so the rate limiter expire timer starts, or use previous
  // limits if this isn't the first API token. It's not catastrophic if this fails since the rows will
  // be created once the user starts to use the token.
  await setTokenPlanLimits(decodedHash, apiTiers[tierPlan as keyof typeof apiTiers], oldLimits)

  // clean up old key limits
  if (typeof oldKey !== "undefined") {
    await deleteTokenPlanLimits(oldKey.hash)
  }

  res.status(200).send({ "trace_id": uuid, "api_key": key.toString() })
})

export default router
