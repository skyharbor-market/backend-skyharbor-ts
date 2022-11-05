import express, { NextFunction, Request, Response } from "express"
import { service_address, service_multiplier, min_value, min_fee } from "../ergofunctions/conf"
import { royalties_scan, generate_p2s } from "../ergofunctions/helpers"
import { decodeNum } from "../ergofunctions/serializer"

const router = express.Router();

/* GET users listing. */
router.get('/', async function (req: Request, res: Response, next: NextFunction) {

  console.log("price ", req.query.price)
  console.log("tokenId ", req.query.tokenId)
  console.log("listerAddress ", req.query.listerAddress)
  let nft_id = req.query.tokenId// "6364439dc9154ba42eb4419310dfbd19a2cfc562e830c68bf3f007db77d9777a"; // My MrWorldwide token
  let list_price = req.query.price //100000; // 0.00
  let description = "Description"
  let lister_address = req.query.listerAddress //"9gksmVmKvCgjQ9dfyDciZKTnFKziB2MwgJS6JLRumzF2Xnmpqi9"

  const tx = await list_NFT(nft_id, list_price, description, lister_address)

  // res.send('creating a transaction', tx);
  res.status(200).send(tx)
});

async function list_NFT(nft_id: any, list_price: any, description: any, lister_address: any) {
  // Service Provider Funding
  let service_value = Math.round(list_price * service_multiplier)
  let service_details = `OUTPUTS(1).value == ${service_value}L, \nOUTPUTS(1).propositionBytes == PK(\"${service_address}\").propBytes`

  // Royalties Funding
  let royalties = await royalties_scan(nft_id)
  let royalty_value = 0
  let royalty_details = ''
  if (royalties) {
    royalty_value = Math.round(list_price * royalties['multiplier'])
    let royalty_address = royalties['address']
    royalty_details = `,\nOUTPUTS(2).value == ${royalty_value}L, \nOUTPUTS(2).propositionBytes == PK(\"${royalty_address}\").propBytes`
  }
  else {
    royalty_details = ''
  }

  // console.log("royalties", royalties)

  // Lister Funding
  let list_value = list_price - service_value - royalty_value
  let lister_details = `OUTPUTS(0).value == ${String(list_value)}L, \nOUTPUTS(0).propositionBytes == PK(\"${lister_address}\").propBytes`

  let script = `{\nval purchaseNFT = allOf(Coll(\n${lister_details},\n` + service_details + royalty_details + "))\nval refundNFT = PK(\"" + lister_address + "\")\nval emergencyEscape = PK(\"" + service_address + "\")\nsigmaProp(purchaseNFT || refundNFT || emergencyEscape)\n}"
  let p2s = await generate_p2s(script)

  // Python version
  // let transaction_to_sign = {
  //     "requests": [
  //         {
  //             "address": p2s,
  //             "value": min_value,
  //             "assets": [
  //                 {'tokenId': nft_id, 'amount': 1}
  //             ],
  //             "registers": {
  //                 'R4': "100204a00b08cd0336100ef59ced80ba5f89c4178ebd57b6c1dd0f3d135ee1db9f62fc634d637041ea02d192a39a8cc7a70173007301"
  //             }
  //         }
  //     ],
  //     "fee": min_fee,
  //     "inputsRaw": min_fee //# REPLACE WITH BOX CONTAINING NFT
  // }

  // Node.js version
  let transaction_to_sign = {
    "requests": [
      {
        "address": p2s,
        "value": min_value,
        "assets": [
          { 'tokenId': nft_id, 'amount': 1 }
        ],
        "registers": {
          'R4': "100204a00b08cd0336100ef59ced80ba5f89c4178ebd57b6c1dd0f3d135ee1db9f62fc634d637041ea02d192a39a8cc7a70173007301"
        }
      }
    ],
    "fee": min_fee,
    "inputsRaw": min_fee //# REPLACE WITH BOX CONTAINING NFT
  }

  console.log(transaction_to_sign)

  // TX to be returned should look like this:
  // const unsigned = {
  //     inputs: ins.map(curIn => {
  //         return {
  //             ...curIn,
  //             extension: {}
  //         }
  //     }),
  //     outputs: [fundBox, changeBox, feeBox],
  //     dataInputs: [],
  //     fee: txFee
  // }

  return transaction_to_sign
  // res.send(transaction_to_sign)
}

export default router
