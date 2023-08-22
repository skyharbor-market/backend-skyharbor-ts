// import requests
// import json
// import os
import dotenv from "dotenv"
import axios from "axios"
import { decodeNum } from "./serializer"
import { Address } from "@coinbarn/ergo-ts";

dotenv.config();
const nodeUrl = "https://paidincrypto.io"

// SWAGGER API KEY
let headers = {
  "api_key": process.env.API_KEY || ""
}

export async function royalties_scan(nft_id: any) {
  let creation_box_registers

  creation_box_registers = await axios.get(`https://api.ergoplatform.com/api/v1/boxes/${nft_id}`)

  // R4 holds the royalties
  // If royalties = 50, it means 5% royalties
  // console.log("r4", creation_box_registers.data.additionalRegisters.R4.renderedValue)

  // let royalty = await decodeNum(creation_box_registers.data.additionalRegisters.R4, true)
  // console.log(royalty)

  if (creation_box_registers) {
    let royalties: any = {}
    royalties['multiplier'] = parseFloat(creation_box_registers.data.additionalRegisters['R4']['renderedValue']) / 1000
    let royalty_ergo_tree = creation_box_registers.data.additionalRegisters['R5']['renderedValue']

    let tempAddress = await axios.get(`${nodeUrl}/utils/ergoTreeToAddress/${royalty_ergo_tree}`)

    royalties['address'] = tempAddress.data['address']
    return royalties
  }
  else {
    return false
  }
}

export async function generate_p2s(script: any) {
  let payload: any = {}
  payload["source"] = script
  const p2s_address_resp = await axios.post(`${nodeUrl}/script/p2sAddress`, payload, { headers: headers });
  const p2s_address = p2s_address_resp.data['address']
  return p2s_address
}

export function getForKey(fav: any) {
  let ret: any[] = []
  return ret
}

export function isAddressValid(address: string) {
  try {
    return new Address(address).isValid();
  } catch (_) {
    return false;
  }
}