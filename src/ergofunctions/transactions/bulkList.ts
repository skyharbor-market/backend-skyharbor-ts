import axios from "axios";
import { Request, Response } from "express";
import {
  txFee,
  supportedCurrencies,
  listingFee, // MAYBE REMOVE LISTING FEE FOR BACKEND
  CHANGE_BOX_ASSET_LIMIT,
} from "../consts";
import { allowedCurrencies } from "../consts";
import { min_value } from "../conf";
import { currentBlock, boxById } from "../explorer";
import { encodeHex, encodeNum, getEncodedBoxSer } from "../serializer";
import { Address } from "@coinbarn/ergo-ts";
import { v4 as uuidv4 } from "uuid";
let ergolib = import("ergo-lib-wasm-nodejs");
// import { signWalletTx } from "../utxos";
import NftAsset from "../../interfaces/NftAsset";

// import { ErgoBox } from "ergo-lib-wasm-nodejs";
import { ErgoBox } from "@coinbarn/ergo-ts";
import { get_utxos } from "../utxos";
import { addressIsValid } from "../../functions/validationChecks";
import { Error } from "../../classes/error";
import { checkIfAssetsAreCorrect } from "../helpers";
const backupNodeUrl = "https://paidincrypto.io";
// const nodeUrl = "https://www.test-skyharbor-server.net:9053/";
const nodeUrl = "https://node.ergo.watch";
// new open node at https://node.ergo.watch/

const serviceAddress = "9h9ssEYyHaosFg6BjZRRr2zxzdPPvdb7Gt7FA8x7N9492nUjpsd";

interface BulkListInterface {
  nfts: NftAsset[];
  userAddresses: string[]; //All user addresses so we can look through all and check if they have balance
}

interface RequestBody {
  nfts: NftAsset[];
  userAddresses: string[];
}

/* TODO

- Allow option for people calling API to add a listing fee to their own address
    - API has optional listingFee var, listingFee: {address: "aksjdn", fee: 3000000000}

- Replace all showMsg with error call
- 
*/

export async function bulkList({ nfts, userAddresses }: BulkListInterface) {
  const wasm = await ergolib;
  const seller = userAddresses[0];
  const isValidAdd = await addressIsValid(seller);
  if (!isValidAdd) {
    console.log("invalid address");
    throw "Address is not valid";
  }
  const blockHeight = await currentBlock();

  let nft: NftAsset;

  // Make interface for "need" variable, should include ERG object and and token ID string as a key value
  let need: any = { ERG: (min_value + txFee) * nfts.length + txFee };
  for (nft of nfts) {
    need[nft.id] = 1;
  }

  // Get all wallet tokens/ERG and see if they have enough
  let have = JSON.parse(JSON.stringify(need));
  have["ERG"] += listingFee * nfts.length;
  let ins: any = [];
  const keys = Object.keys(have);

  //   const allBal = await getTokens();
  //   if (
  //     keys
  //       .filter((key) => key !== "ERG")
  //       .filter(
  //         (key) =>
  //           !Object.keys(allBal).includes(key) || allBal[key].amount < have[key]
  //       ).length > 0
  //   ) {
  //     showMsg("Not enough balance in the wallet! See FAQ for more info.", true);
  //     return;
  //   }

  for (let i = 0; i < keys.length; i++) {
    if (have[keys[i]] <= 0) continue;
    // const curIns = await ergo.get_utxos(have[keys[i]].toString(), keys[i]);
    // console.log("bx", await ergo.get_utxos())
    // console.log("have[keys[i]].toString(): ", have[keys[i]].toString(), keys[i])

    // iterate through all addresses - make sure no boxes are duplicated if boxes are found
    // for(let add of userAddresses) {

    // }

    // Without dapp connector
    let curIns;
    if (keys[i] === "ERG") {
      curIns = await get_utxos(seller, have[keys[i]].toString());
    } else {
      curIns = await get_utxos(seller, 0, keys[i], have[keys[i]].toString());
    }

    if (curIns !== undefined) {
      //@ts-ignore
      curIns.forEach((bx: ErgoBox) => {
        //@ts-ignore
        have["ERG"] -= parseInt(bx.value);
        bx.assets.forEach((ass) => {
          if (!Object.keys(have).includes(ass.tokenId)) have[ass.tokenId] = 0;
          have[ass.tokenId] -= parseInt(ass.amount);
        });
      });
      ins = ins.concat(curIns);
    }
  }
  if (keys.filter((key) => have[key] > 0).length > 0) {
    return "Not enough balance in the wallet! See FAQ for more info.";
  }
  let publicKeyResponse = await axios
    .get(`${nodeUrl}/utils/addressToRaw/` + seller)
    .catch((err) => {
      console.log(
        "Error when calling utils/addressToRaw/useraddress, using backup"
      );
    });

  //@ts-ignore
  if (!publicKeyResponse.data) {
    try {
      publicKeyResponse = await axios.get(
        `${backupNodeUrl}/utils/addressToRaw/` + seller
      );
    } catch {
      console.log("Error when calling utils/addressToRaw/useraddress");

      return;
    }
  }

  //@ts-ignore
  if (!publicKeyResponse.data) {
    return "There was an error calling Node API, please try again later or notify support";
  }

  //@ts-ignore
  let publicKey = publicKeyResponse.data.raw;

  let nftOut: NftAsset;
  let listedBoxes: ErgoBox[] = [];

  for (nftOut of nfts) {
    let artBox = await boxById(nftOut.id);
    let p2s = supportedCurrencies[nftOut.currency].contractAddress;

    const encodedSer = await getEncodedBoxSer(artBox).catch((err) => {
      console.log("Error: ", err);
      return "Listing is currently unavailable, please try again later";
    });

    if (!encodedSer) {
      return;
    }

    let registers = {
      R4: await encodeNum(nftOut?.price?.toString()),
      R5: await encodeHex(new Address(seller).ergoTree),
      R6: encodedSer,
      R7: "07" + publicKey,
    };
    listedBoxes.push({
      //@ts-ignore
      value: (min_value + txFee).toString(),
      ergoTree: wasm.Address.from_mainnet_str(p2s)
        .to_ergo_tree()
        .to_base16_bytes(), // p2s to ergotree (can do through node or wasm)
      assets: [{ tokenId: nftOut.id, amount: "1" }],
      additionalRegisters: registers,
      creationHeight: blockHeight.height,
    });
  }
  // -----------Output boxes--------------

  // const payServiceFee = {
  //   value: (listingFee * nfts.length).toString(),
  //   ergoTree: wasm.Address.from_mainnet_str(serviceAddress)
  //     .to_ergo_tree()
  //     .to_base16_bytes(),
  //   assets: [],
  //   creationHeight: blockHeight.height,
  //   additionalRegisters: {},
  // };

  const changeBox = {
    value: (-have["ERG"]).toString(),
    ergoTree: wasm.Address.from_mainnet_str(seller)
      .to_ergo_tree()
      .to_base16_bytes(),
    assets: Object.keys(have)
      .filter((key) => key !== "ERG")
      .filter((key) => have[key] < 0)
      .map((key) => {
        return {
          tokenId: key,
          amount: (-have[key]).toString(),
        };
      }),
    additionalRegisters: {},
    creationHeight: blockHeight.height,
  };

  if (changeBox.assets.length > CHANGE_BOX_ASSET_LIMIT) {
    return "Too many NFTs in input boxes to form single change box. Please de-consolidate some UTXOs. Contact the team on discord for more information.";
  } else {
    const feeBox = {
      value: txFee.toString(),
      creationHeight: blockHeight.height,
      ergoTree:
        "1005040004000e36100204a00b08cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ea02d192a39a8cc7a701730073011001020402d19683030193a38cc7b2a57300000193c2b2a57301007473027303830108cdeeac93b1a57304",
      assets: [],
      additionalRegisters: {},
    };

    // Version with service fee
    // let outputs = listedBoxes.concat([payServiceFee, changeBox, feeBox]);

    // Version without service fee
    // @ts-ignore
    let outputs = listedBoxes.concat([changeBox, feeBox]);

    const transaction_to_sign = {
      //@ts-ignore
      inputs: ins.map((curIn) => {
        return {
          ...curIn,
          extension: {},
        };
      }),
      outputs: outputs,
      dataInputs: [],
      fee: txFee,
    };
    console.log("transaction_to_sign", transaction_to_sign);

    return transaction_to_sign;
  }
}

// Bulk List and Single List are same method currently
export async function postBulkList(req: Request, res: Response) {
  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  const uuid = uuidv4();
  const body: RequestBody = req.body;
  console.log("BODY:", body);

  if (body === undefined) {
    res.status(400);
    res.send({
      message: "API requires a body.",
      uuid: uuid,
    });
    return 400001;
  } else if (body.nfts === undefined) {
    return 400002;
  } else if (!checkIfAssetsAreCorrect(body.nfts)) {
    res.status(400);
    res.send({
      message:
        "One of your body.nfts objects are built wrong. Must include id, price, and a supported currency.",
      uuid: uuid,
    });
    return 400003;
  } else if (
    body.userAddresses === undefined ||
    body.userAddresses.length === 0
  ) {
    res.status(400);
    res.send({
      message: "body.userAddresses is not found.",
      uuid: uuid,
    });
    return 400004;
  }
  // if req.nfts is not an array, but only a single nft asset, then add the single nft asset into an array: [nft],
  //   then pass it into bulkList
  let allNfts = [];
  if (Array.isArray(body.nfts)) {
    allNfts = body.nfts;
  } else {
    allNfts = [body.nfts];
  }

  console.log("typeof body.nfts", typeof body.nfts);
  console.log("allNfts", allNfts);

  let transaction_to_sign;
  try {
    transaction_to_sign = await bulkList({
      nfts: allNfts,
      userAddresses: body.userAddresses,
    });
  } catch (err) {
    res.status(400);
    res.send({
      error: true,
      message: err,
      uuid: uuid,
    });
    return;
  }

  // return transaction_to_sign;
  res.status(200);
  res.send({
    error: false,
    transaction_to_sign: transaction_to_sign,
    uuid: uuid,
  });
  return;
}
