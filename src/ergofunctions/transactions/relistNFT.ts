import { getListedBox } from "../helpers";
import { txFee, supportedCurrencies, CHANGE_BOX_ASSET_LIMIT } from "../consts";
import { min_value } from "../conf";
import { currentBlock } from "../explorer";
import { encodeNum } from "../serializer";
import { get_utxos } from "../utxos";
import { BuyBoxInterface, EmptyBuyBoxInterface } from "../../interfaces/BuyBox";
import { Request, Response } from "express";
import { addressIsValid } from "../../functions/validationChecks";

let ergolib = import("ergo-lib-wasm-nodejs");

// const nodeUrl = "https://paidincrypto.io";
// const nodeUrl = "https://www.test-skyharbor-server.net:9053/";
const nodeUrl = "https://node.ergo.watch";
// new open node at https://node.ergo.watch/

const serviceAddress = "9h9ssEYyHaosFg6BjZRRr2zxzdPPvdb7Gt7FA8x7N9492nUjpsd";
const minterServiceAddress =
  "9h9ssEYyHaosFg6BjZRRr2zxzdPPvdb7Gt7FA8x7N9492nUjpsd";

// -------------------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------- Relist an NFT -----------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------
interface RelistInterface {
  relistBox: BuyBoxInterface | EmptyBuyBoxInterface;
  list_price: number;
  currency: string;
  userAddresses: string[];
}

export async function relist_NFT({
  relistBox,
  list_price,
  currency = "erg",
  userAddresses,
}: RelistInterface) {
  const wasm = await ergolib;

  const relister = userAddresses[0];
  
  const isValidAdd = await addressIsValid(relister);
  if (!isValidAdd) {
    console.log("invalid address");
    throw "Address is not valid";
  }

  const blockHeight = await currentBlock();

  let tempBox = relistBox
  if(typeof relistBox === "string") {
    tempBox = {
      box_id: relistBox
    }
  }

  let listedBox;
  try {
    listedBox = await getListedBox(tempBox as BuyBoxInterface);
  } catch (err) {
    console.log("ERRRE", err);
    throw "Error getting NFT listing."
  }

  listedBox.additionalRegisters.R4 =
    listedBox.additionalRegisters.R4.serializedValue;
  listedBox.additionalRegisters.R5 =
    listedBox.additionalRegisters.R5.serializedValue;
  listedBox.additionalRegisters.R7 =
    listedBox.additionalRegisters.R7.serializedValue;
  const p2s = supportedCurrencies[currency].contractAddress;

  const requiredErg = min_value + txFee;
  let need = { ERG: requiredErg };
  // Get all wallet tokens/ERG and see if they have enough
  let have = JSON.parse(JSON.stringify(need));
  have["ERG"] += txFee - listedBox.value;

  let ins: any = [];
  const keys = Object.keys(have);

  for (let i = 0; i < keys.length; i++) {
    if (have[keys[i]] <= 0) continue;
    let curIns;
    // Without dapp connector
    if (keys[i] === "ERG") {
      curIns = await get_utxos(relister, have[keys[i]].toString());
    } else {
      curIns = await get_utxos(relister, 0, keys[i], have[keys[i]].toString());
    }

    if (curIns !== undefined) {
      curIns.forEach((bx) => {
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
    throw "Not enough balance in the wallet! See FAQ for more info";
  }

  // -----------Output boxes--------------
  let registers = {
    R4: await encodeNum(list_price.toString()),
    R5: listedBox.additionalRegisters.R5,
    R6: listedBox.additionalRegisters.R6,
    R7: listedBox.additionalRegisters.R7,
  };

  const relistedBox = {
    value: (min_value + txFee).toString(),
    ergoTree: wasm.Address.from_mainnet_str(p2s)
      .to_ergo_tree()
      .to_base16_bytes(), // p2s to ergotree (can do through node or wasm)
    assets: [
      {
        tokenId: listedBox.assets[0].tokenId,
        amount: listedBox.assets[0].amount,
      },
    ],
    additionalRegisters: registers,
    creationHeight: blockHeight.height,
  };

  const changeBox = {
    value: (-have["ERG"]).toString(),
    ergoTree: wasm.Address.from_mainnet_str(relister)
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
    throw "Too many NFTs in input boxes to form single change box. Please de-consolidate some UTXOs. Contact the team on discord for more information.";
  } else {
    const feeBox = {
      value: txFee.toString(),
      creationHeight: blockHeight.height,
      ergoTree:
        "1005040004000e36100204a00b08cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ea02d192a39a8cc7a701730073011001020402d19683030193a38cc7b2a57300000193c2b2a57301007473027303830108cdeeac93b1a57304",
      assets: [],
      additionalRegisters: {},
    };

    let inputList = ins.map((curIn: any) => {
      return {
        ...curIn,
        extension: {},
      }; // this gets all user eutxo boxes (need to look into how we can get curIn)
    });
    const inputBoxes = inputList.concat(listedBox);
    const transaction_to_sign = {
      inputs: inputBoxes,
      outputs: [changeBox, relistedBox, feeBox],
      dataInputs: [],
      fee: txFee,
    };

    return transaction_to_sign;
  }
}

// RELIST NFT
interface EditRequestBody {
  editBox: BuyBoxInterface | EmptyBuyBoxInterface;
  currency: string;
  newPrice: number;
  userAddresses: string[];
}

export async function postEditNFT(req: Request, res: Response) {
  const body: EditRequestBody = req.body;
  console.log("BODY:", body);

  /* CHECKS:
    - Check if box_id is a legitimate id
    - Check if NFT is actually for sale
  */

  if (body === undefined) {
    res.status(400);
    res.send({
      message: "API requires a body.",
    });
    return 400001;
  } else if (body.editBox === undefined) {
    res.status(400);
    res.send({
      message: "body.editBox not found.",
    });
    return 400002;
  } else if (body.currency === undefined) {
    res.status(400);
    res.send({
      message: "body.currency not found.",
    });
    return 400003;
  } else if (body.newPrice === undefined) {
    res.status(400);
    res.send({
      message: "body.newPrice not found.",
    });
    return 400003;
  } else if (
    body.userAddresses === undefined ||
    body.userAddresses.length === 0
  ) {
    res.status(400);
    res.send({
      message: "body.userAddresses is not found.",
    });
    return 400004;
  }

  let transaction_to_sign;
  try {
    transaction_to_sign = await relist_NFT({
      relistBox: body.editBox,
      currency: body.currency,
      list_price: body.newPrice,
      userAddresses: body.userAddresses,
    });
  } catch (err) {
    res.status(400);
    res.send({
      error: true,
      message: err,
    });
    return;
  }

  res.status(200);
  res.send({
    error: false,
    transaction_to_sign: transaction_to_sign,
  });
  return;
};