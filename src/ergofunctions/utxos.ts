import axios from "axios";
import { skyHarborApi } from "./consts";
import { boxById as boxByBoxId, currentBlock as currentHeight, getTokenBoxV1, unspentBoxesForV1 } from "./explorer";
import { encodeContract, ergoTreeToAddress } from "./serializer";
// let ergolib = import('ergo-lib-wasm-browser')

/* global BigInt */

export async function get_utxos(walletAddr: string, reqErg: any, tokenId = "", reqtokenAmt = 0) {
  const unspent = await unspentBoxesForV1(walletAddr)
  const finalUtxos = []
  let assets = []
  let addBox = false
  let ergAmtRemainder = reqErg
  let tokenAmtRemainder = reqtokenAmt
  console.log("unspent", unspent)
  console.log("reqErg", reqErg)
  console.log("tokenId", tokenId)
  console.log("reqtokenAmt", reqtokenAmt)
  // sort unspent list by erg amount
  if (unspent?.length === 0) {
    return []
  }

  unspent?.sort((a: { value: number }, b: { value: number }) => {
    return b.value - a.value
  })

  for (let i = 0; i < unspent.length; i++) {
    let box = unspent[i]
    // check for required ERG
    if (ergAmtRemainder > 0) {
      addBox = true
      ergAmtRemainder -= box.value
    }

    if (tokenId !== "") {
      // check for tokenId
      for (let j = 0; j < box.assets.length; j++) {
        let tok = box.assets[j]
        if (tok.tokenId === tokenId) {
          // check for required tokenAmt
          if (tokenAmtRemainder > 0) {
            addBox = true
            tokenAmtRemainder -= tok.amount
            break
          }
        }
      }
    }

    if (addBox) {
      for (let k = 0; k < box.assets.length; k++) {
        let a = box.assets[k]
        assets.push({
          "tokenId": a.tokenId,
          "amount": a.amount
        })
      }

      finalUtxos.push({
        "boxId": box.boxId,
        "value": box.value,
        "ergoTree": box.ergoTree,
        "creationHeight": box.creationHeight,
        "assets": assets,
        "additionalRegisters": box.additionalRegisters,
        "transactionId": box.transactionId,
        "index": box.index,
        "extension": box.extension
      })
    }

    if (tokenAmtRemainder <= 0 && ergAmtRemainder <= 0) {
      break
    }

    addBox = false
    assets = []
  }

  // do a final sanity check if we found all utxos to meet our requirements,
  // if not we return an empty array
  if (tokenAmtRemainder > 0 || ergAmtRemainder > 0) {
    return []
  }

  return finalUtxos
}

export function parseUtxo(json: any, addExtention = true, mode = 'input') {
  if (json === undefined) {
    return {};
  }
  let res: any = {}
  if (mode === 'input') {
    if ("id" in json) {
      res["boxId"] = json.id;
    } else {
      res["boxId"] = json.boxId;
    }
  }
  res["value"] = json.value.toString();
  res["ergoTree"] = json.ergoTree;
  if (Array.isArray(json.assets)) {
    res["assets"] = json.assets.map((asset: { tokenId: any; amount: { toString: () => any; }; }) => ({
      tokenId: asset.tokenId,
      amount: asset.amount.toString(),
    }));
  } else {
    res["assets"] = [];
  }
  if (isDict(json["additionalRegisters"])) {
    res["additionalRegisters"] = parseAdditionalRegisters(json.additionalRegisters);
  } else {
    res["additionalRegisters"] = {};
  }

  res["creationHeight"] = json.creationHeight;

  if (mode === 'input') {
    if ("txId" in json) {
      res["transactionId"] = json.txId;
    } else {
      res["transactionId"] = json.transactionId;
    }
    res["index"] = json.index;
  }
  if (addExtention) {
    res["extension"] = {};
  }
  return res;
}

export function parseUtxos(utxos: any[], addExtention?: boolean | undefined, mode = 'input') {
  var utxosFixed = [];
  for (const i in utxos) {
    utxosFixed.push(parseUtxo(utxos[i], addExtention, mode))
  }
  return utxosFixed;
}

export async function enrichUtxos(utxos: { [x: string]: any; }, addExtension: boolean = false) {
  let utxosFixed = [];

  for (const i in utxos) {
    let key = "boxId";
    if ("id" in utxos[i]) {
      key = "id";
    }
    //console.log("enrichUtxos1", utxos[i][key]);
    const box = await boxByBoxId(utxos[i][key]);
    let newAssets = []
    for (let token of box.assets) {
      let newToken = { ...token }
      //console.log("enrichUtxos2", token.tokenId);
      const tokenDesc = await getTokenBoxV1(token.tokenId);
      newToken["name"] = tokenDesc.name;
      newToken["decimals"] = tokenDesc.decimals;
      newAssets.push(newToken)
    }
    let newBox: any = {}
    for (const key of Object.keys(box)) {
      if (key === "assets") {
        newBox[key] = newAssets;
      } else {
        newBox[key] = box[key];
      }
    }
    //console.log("enrichUtxos3 newBox", newBox)
    try {
      const addr = await ergoTreeToAddress(newBox["ergoTree"]);
      //console.log("enrichUtxos4 addr", addr)
      if (!("address" in utxos[i])) {
        newBox["address"] = addr;
      }
    } catch (e) {
      console.log(e)
    }
    if (addExtension && !Object.keys(newBox).includes("extension")) {
      newBox["extension"] = {};
    }
    utxosFixed.push(newBox);
  }
  //console.log("enrichUtxos5", utxosFixed)
  return utxosFixed;
}

function parseAdditionalRegisters(json: { [s: string]: any; } | ArrayLike<unknown>) {
  let registterOut: any = {}
  Object.entries(json).forEach(([key, value]) => {
    if (isDict(value)) {
      registterOut[key] = value["serializedValue"];
    } else {
      registterOut[key] = value;
    }
  });
  return registterOut;
}

function parseInput(input: any) {
  let res: any = {}
  if ("id" in input) {
    res["boxId"] = input.id;
  } else {
    res["boxId"] = input.boxId;
  }
  if ("extension" in input) {
    res["extension"] = input.extension;
  } else {
    res["extension"] = {};
  }
  return res;
}
function parseInputs(inputs: any) {
  return inputs.map((input: any) => parseInput(input));
}

export function parseUnsignedTx(json: { inputs: any; dataInputs: any; outputs: any; }) {
  let res: any = {}
  res["inputs"] = parseInputs(json.inputs);
  res["dataInputs"] = parseInputs(json.dataInputs);
  res["outputs"] = parseUtxos(json.outputs, false, 'output');
  console.log("parseUnsignedTx", json, res)
  return res;
}

function parseSignedInputSwagger(input: { id: any; spendingProof: any; }) {
  console.log("parseSignedInputSwagger", input);
  return {
    boxId: input.id,
    spendingProof: input.spendingProof,
  }
}
function parseSignedInputsSwagger(inputs: any[]) {
  return inputs.map((input: any) => parseSignedInputSwagger(input));
}


export function parseSignedTx(tx: { dataInputs: any; inputs: any; outputs: any; id: any; }) {
  let res: any = {}
  res["dataInputs"] = parseSignedInputsSwagger(tx.dataInputs);
  res["inputs"] = parseSignedInputsSwagger(tx.inputs);
  res["outputs"] = tx.outputs;
  res["id"] = tx.id;
  return res;
}

export function generateSwaggerTx(json: { inputs: any; hasOwnProperty: (arg0: string) => any; tx_id: any; data_inputs: any; dataInputs: any; outputs: any; }) {
  console.log("generateSwaggerTx", json);
  let res: any = {}

  var newInputs = [];
  for (const input of json.inputs) {
    newInputs.push(parseSignedInputSwagger(input));
  }
  if (json.hasOwnProperty("tx_id")) {
    res["id"] = json.tx_id;
  }
  res["inputs"] = newInputs;
  if (json.hasOwnProperty("data_inputs")) {
    res["dataInputs"] = json.data_inputs;
  } else {
    res["dataInputs"] = json.dataInputs;
  }

  res["outputs"] = json.outputs;
  return res;
}

export function getUtxosListValue(utxos: any[]) {
  return utxos.reduce((acc: any, utxo: { value: any; }) => acc += BigInt(utxo.value), BigInt(0));
}

export function getTokenListFromUtxos(utxos: { [x: string]: { assets: { [x: string]: { tokenId: string, amount: string; }; }; }; }) {
  let tokenList: any = {}
  for (const i in utxos) {
    for (const j in utxos[i].assets) {
      if (utxos[i].assets[j].tokenId in tokenList) {
        tokenList[utxos[i].assets[j].tokenId] = parseInt(tokenList[utxos[i].assets[j].tokenId]) + parseInt(utxos[i].assets[j].amount);
      } else {
        tokenList[utxos[i].assets[j].tokenId] = parseInt(utxos[i].assets[j].amount);
      }
    }
  }
  return tokenList;
}

export function getMissingErg(inputs: any[], outputs: any[]) {
  const amountIn = getUtxosListValue(inputs);
  const amountOut = getUtxosListValue(outputs);
  if (amountIn >= amountOut) {
    return amountIn - amountOut;
  } else {
    return 0;
  }
}

export function getMissingTokens(inputs: any, outputs: any) {
  const tokensIn = getTokenListFromUtxos(inputs);
  const tokensOut = getTokenListFromUtxos(outputs);
  let res: any = {}
  console.log("getMissingTokens", tokensIn, tokensOut);
  if (tokensIn !== {}) {
    for (const token in tokensIn) {
      if (tokensOut !== {} && token in tokensOut) {
        if (tokensIn[token] - tokensOut[token] > 0) {
          res[token] = tokensIn[token] - tokensOut[token];
        }
      } else {
        res[token] = tokensIn[token];
      }
    }
  }
  console.log("getMissingTokens", tokensIn, tokensOut, res);
  return res;
}

export function buildTokenList(tokens: { [x: string]: { toString: () => any; }; }) {
  var res = [];
  if (tokens !== {}) {
    for (const i in tokens) {
      res.push({ "tokenId": i, "amount": tokens[i].toString() });
    }
  };
  return res;
}

export async function buildBalanceBox(inputs: any[], outputs: any[], address: any) {
  const missingErgs = getMissingErg(inputs, outputs).toString();
  const contract = await encodeContract(address);
  const tokens = buildTokenList(getMissingTokens(inputs, outputs));
  const height = await currentHeight();
  console.log("buildBalanceBox", missingErgs, contract, tokens, height)

  return {
    value: missingErgs,
    ergoTree: contract,
    assets: tokens,
    additionalRegisters: {},
    creationHeight: height,
    extension: {}
  };
}

function isDict(v: unknown) {
  return typeof v === 'object' && v !== null && !(v instanceof Array) && !(v instanceof Date);
}

async function getUtxoContentForAddressList(utxos: any, addressList: string | any[]) {
  var value = 0, tokens = [];
  //console.log("getUtxoContentForAddressList_0", utxos, addressList)
  for (var utxo of utxos) {
    if (!("address" in utxo)) {
      if (!("assets" in utxo)) {
        if ("id" in utxo) {
          utxo = await boxByBoxId(utxo.id);
        } else {
          utxo = await boxByBoxId(utxo.boxId);
        }
        //console.log("getUtxoContentForAddressList_1 enriched", utxo)
      }
      try {
        utxo["address"] = await ergoTreeToAddress(utxo.ergoTree);
        //console.log("getUtxoContentForAddressList_2 address", utxo);
      } catch (e) {
        console.log(e);
      }
    }
    if (addressList.includes(utxo.address)) {
      //console.log("getUtxoContentForAddressList_3")
      value = value + parseInt(utxo.value.toString());
      if (!("assets" in utxo)) {
        utxo.assets = (await boxByBoxId(utxo.id)).assets;
      }
      if (!(Array.isArray(utxo.assets))) {
        utxo.assets = [];
      }
      for (const token of utxo.assets) {
        //console.log("getUtxoContentForAddressList_4")
        if (tokens.map(tok => tok.tokenId).includes(token.tokenId)) {
          const index = tokens.findIndex(t => t.tokenId === token.tokenId);
          const tokAmount = parseInt(token.amount.toString());
          //console.log("getUtxoContentForAddressList_4", token.tokenId, tokens[index].amount, tokAmount)
          tokens[index].amount = tokens[index].amount + tokAmount;
        } else {
          tokens.push({ ...token });
        }
      }
    }
  }
  return { value: value, tokens: tokens };
}

function getUtxoContentForAddressList2(utxos: any, addressList: string | any[]) {
  //console.log("getUtxoContentForAddressList_20", utxos, addressList)
  var value = 0, tokens = [];
  for (var utxo of utxos) {
    //console.log("getUtxoContentForAddressList_21", utxo)
    if (addressList.includes(utxo.address)) {
      //console.log("getUtxoContentForAddressList_22", value)
      value += parseInt(utxo.value.toString());
      for (const token of utxo.assets) {
        const index = tokens.findIndex(t => t.tokenId === token.tokenId);
        //console.log("getUtxoContentForAddressList_23", index)
        if (index >= 0) {
          //console.log("getUtxoContentForAddressList_24", token, tokens[index].amount)
          const tokAmount = parseInt(token.amount.toString());
          tokens[index].amount = tokens[index].amount + tokAmount;
          //console.log("getUtxoContentForAddressList_25", token, tokens[index].amount, tokAmount)
        } else {
          //console.log("getUtxoContentForAddressList_26", token)
          tokens.push({ ...token });
        }
      }
    }
  }
  //console.log("getUtxoContentForAddressList_27", { value: value, tokens: tokens })
  return { value: value, tokens: tokens };
}


export async function getUtxoBalanceForAddressList(inputs: any, outputs: any, addressList: string | any[]) {
  //console.log("getUtxoBalanceForAddressList params", inputs, outputs, addressList);
  const inputBal = await getUtxoContentForAddressList(inputs, addressList);
  const outputBal = await getUtxoContentForAddressList(outputs, addressList);
  //console.log("getUtxoBalanceForAddressList", inputBal, outputBal, addressList);
  return buildBalance(inputBal, outputBal);
}

export function getUtxoBalanceForAddressList2(inputs: any, outputs: any, addressList: string | any[]) {
  //console.log("getUtxoBalanceForAddressList2 params", inputs, outputs, addressList);
  const inputBal = getUtxoContentForAddressList2(inputs, addressList);
  const outputBal = getUtxoContentForAddressList2(outputs, addressList);
  //console.log("getUtxoBalanceForAddressList2", inputBal, outputBal, addressList);
  return buildBalance(inputBal, outputBal);
}

function buildBalance(inputBal: { value: any; tokens: any; }, outputBal: { value: any; tokens: any; }) {
  //console.log("buildBalance1", inputBal, outputBal)
  const balValue = parseInt(outputBal.value.toString()) - parseInt(inputBal.value.toString());
  var balTokens = [];
  const tokenList = [...new Set([inputBal.tokens.map((tok: { tokenId: any; }) => tok.tokenId), outputBal.tokens.map((tok: { tokenId: any; }) => tok.tokenId)].flat())];
  for (const tokId of tokenList) {

    var tokAmount = 0, decimals = 0, tokenName = '';
    for (const outToken of outputBal.tokens) {
      if (outToken.tokenId === tokId) {
        tokAmount += parseInt(outToken.amount.toString());
        decimals = outToken.decimals;
        tokenName = outToken.name;
      }
    }
    for (const inToken of inputBal.tokens) {
      if (inToken.tokenId === tokId) {
        tokAmount -= parseInt(inToken.amount.toString());
        decimals = inToken.decimals;
        tokenName = inToken.name;
      }
    }
    if (tokAmount !== 0) {
      balTokens.push({
        tokenId: tokId,
        amount: tokAmount,
        decimals: decimals,
        name: tokenName,
      });
    }
  }
  //console.log("buildBalance2", inputBal, outputBal, balValue, balTokens);
  return { value: balValue, tokens: balTokens };
}

// export const getRequiredInputs = async (need, userAddress) =>{

//     const wasm = await ergolib

//     let have = JSON.parse(JSON.stringify(need))
//     have['ERG'] += txFee
//     let ins = []
//     const keys = Object.keys(have)

//         // Gets user inputs, as well as checks if they have enough
//         for (let i = 0; i < keys.length; i++) {
//             if (have[keys[i]] <= 0) continue

//             let curIns = []
//             // With dapp connector
//             // const curIns = await ergo.get_utxos(have[keys[i]].toString(), keys[i]);

//             // Without dapp connector
//             if (keys[i] === 'ERG') {
//                 curIns = await get_utxos(userAddress, have[keys[i]].toString());
//             }
//             else {
//                 curIns = await get_utxos(userAddress, 0, keys[i], have[keys[i]].toString());
//             }

//             // const curIns = await get_utxos(buyer, requiredErg);
//             if (curIns !== undefined) {
//                 curIns.forEach(bx => {
//                     have['ERG'] -= parseInt(bx.value)
//                     bx.assets.forEach(ass => {
//                         if (!Object.keys(have).includes(ass.tokenId)) have[ass.tokenId] = 0
//                         have[ass.tokenId] -= parseInt(ass.amount)
//                     })
//                 })
//                 ins = ins.concat(curIns)
//             }
//         }
//         if (keys.filter(key => have[key] > 0).length > 0) {
//             showMsg('Not enough balance in the wallet! See FAQ for more info.', true)
//             return
//         }

//         return ins
// }
