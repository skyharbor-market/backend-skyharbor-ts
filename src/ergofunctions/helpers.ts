// import requests
// import json
// import os
import dotenv from "dotenv"
import axios from "axios"
import { decodeNum, getEncodedBoxSer } from "./serializer"
import { Address, ErgoBox } from "@coinbarn/ergo-ts";
import { allowedCurrencies } from "./consts";
import NftAsset from "../interfaces/NftAsset";
import { boxById, explorerApiV1 } from "./explorer";
import { BuyBoxInterface, EmptyBuyBoxInterface } from "../interfaces/BuyBox";

dotenv.config();

// const nodeUrl = "https://paidincrypto.io"
const nodeUrl = "https://node.ergo.watch"
// const nodeUrl = "https://www.test-skyharbor-server.net:9053"


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


export async function getListedBox(buyBox: BuyBoxInterface) {
  // Get listed Box from explorer
  let listedBox;
  if (!buyBox?.box_json) {
    let tempBox = await axios.get(`${explorerApiV1}/boxes/${buyBox.box_id}`);
    listedBox = tempBox.data;
  } else {
    listedBox = JSON.parse(JSON.stringify(buyBox.box_json));
  }
  listedBox.extension = {};
  // Add R6 to listedBox since explorer does not return it

  if (!listedBox?.assets[0]?.tokenId) {
    throw "Could not find listed asset"
  }

  let buyArtBox = await boxById(listedBox.assets[0].tokenId);

  try {
    listedBox.additionalRegisters.R6 = await getEncodedBoxSer(buyArtBox);
  } catch {
    console.log("Get EncodedBoxSer Failed, attempting to get R6 through node");

    const resp = await axios.get(
      `${explorerApiV1}/transactions/${listedBox.transactionId}`
    );
    const nodeResp = await axios.get(
      `${nodeUrl}/blocks/${resp.data.blockId}/transactions`
    );

    let blockObject = nodeResp.data.transactions;
    let tx;
    for (tx of blockObject) {
      for (let i = 0; i < tx.outputs.length; i++) {
        if (tx.outputs[i].boxId === listedBox.boxId) {
          listedBox.additionalRegisters.R6 =
            tx.outputs[i].additionalRegisters.R6;
        }
      }
    }
  }

  return listedBox;
}


export function getForKey(fav: any) {
  let ret: any[] = []
  return ret
}

export function checkIfAssetsAreCorrect(nft: NftAsset | NftAsset[]) {
  let allNfts: NftAsset[];

  if (!Array.isArray(nft)) {
    allNfts = [nft];
  } else {
    allNfts = nft;
  }

  for (let n of allNfts) {
    if (
      !n.id ||
      !n.price ||
      !n.currency ||
      !allowedCurrencies.includes(n?.currency)
    ) {
      return false;
    }
  }

  return true;
}


export function isAddressValid(address: string) {
  try {
    return new Address(address).isValid();
  } catch (_) {
    return false;
  }
}