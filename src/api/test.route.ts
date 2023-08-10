import express, { Request, Response } from "express"
import cors from "cors"
import { currentHeight } from "../ergofunctions/explorer"
import { txFee } from "../ergofunctions/consts"
import { get_utxos } from "../ergofunctions/utxos"
// import {
//   Address,
//   BoxValue,
//   Contract,
//   ErgoBoxCandidate,
//   ErgoBoxCandidates,
//   ErgoBoxCandidateBuilder,
//   ErgoTree,
//   I64,
//   NonMandatoryRegisterId,
//   TokenAmount,
//   TokenId,
//   Constant,
//   BlockHeaders,
//   ErgoBoxes,
//   ErgoStateContext,
//   PreHeader,
//   ReducedTransaction,
//   UnsignedTransaction
// } from "ergo-lib-wasm-nodejs"

import { OutputBuilder, TransactionBuilder, SConstant, SByte, SLong, SSigmaProp, SUnit, SColl } from "@fleet-sdk/core";

const router = express.Router();

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

router.post('/test', cors(options), async (req: Request, res: Response) => {

  // pull out wallet address from body and any other important data
  const walletAddr = req.body.walletAddr
  const nftId = req.body.nftId

  // get input and output utxos from wallet address (or addresses)
  // by making sure the utxo boxes have enough erg and the correct
  // NFT token id(s)
  // get_utxos(walletAddr: string, reqErg: any, tokenId = "", reqtokenAmt = 0)
  const utxos = get_utxos(walletAddr, 0, nftId)

  // start to build tx using fleet-sdk
  const blockHeight = await currentHeight()
  let inputUtxos = new Array()

  let outputArray = [
    new OutputBuilder("123", "abcdef", blockHeight)
      .setAdditionalRegisters({
        R4: SConstant(SColl(SByte, Buffer.from("123456", 'hex')))
      }),
    new OutputBuilder("123", "abcdef", blockHeight),
  ]

  const unsignedTransaction = new TransactionBuilder(blockHeight)
    .from(inputUtxos)
    .to(outputArray)
    .sendChangeTo(walletAddr)
    // .configureSelector((selector) => selector.ensureInclusion((input) => input.boxId === listedBox.boxId))
    .payMinFee()
    .build()
    .toEIP12Object()

  console.log("Unsigned TX: ", unsignedTransaction)

  // we can reducedB64Safe this tx for ergopay here and save it to the DB

  const unsignedTx = JSON.stringify(unsignedTransaction)
  const txId = unsignedTransaction.id

  res.status(200)
  res.send({ "txId": txId })
})

export default router