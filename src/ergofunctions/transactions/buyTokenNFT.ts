import {
  getListedBox,
  // getOracleBox
} from "../helpers";
// import { txFee, CHANGE_BOX_ASSET_LIMIT, supportedCurrencies } from "../consts";
// import { currentBlock } from "../explorer";
// import { encodeHex, getRoyaltyInfo, RoyaltyInterface } from "../serializer";
// import { minBoxValue } from "@coinbarn/ergo-ts";
// import { getConnectorAddress, getTokens } from "../walletUtils";
import NftAsset, { Currency } from "../../interfaces/NftAsset";
import { BuyBoxInterface } from "../../interfaces/BuyBox";

let ergolib = import("ergo-lib-wasm-nodejs");

// const nodeUrl = "https://paidincrypto.io";
const nodeUrl = "https://node.ergo.watch";

const serviceAddress = "9h9ssEYyHaosFg6BjZRRr2zxzdPPvdb7Gt7FA8x7N9492nUjpsd";
const minterServiceAddress =
  "9h9ssEYyHaosFg6BjZRRr2zxzdPPvdb7Gt7FA8x7N9492nUjpsd";

interface BulkListInterface {
  nfts: NftAsset[];
  userAddresses: string[]; //All user addresses so we can look through all and check if they have balance
}

// -------------------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------- Buying an NFT -----------------------------------------------------
// -------------------------------------------------- Using Native Tokens --------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------

interface BuyInterface {
  buyBox: BuyBoxInterface;
  userAddresses: string[]; //All user addresses so we can look through all and check if they have balance
  currency: Currency;
}

export async function buyTokenNFT({
  buyBox,
  userAddresses,
  currency,
}: BuyInterface) {
  return;
  // const wasm = await ergolib;

  // const currencyId = supportedCurrencies[currency].id;

  // const buyer = await getConnectorAddress();
  // console.log("buyer", buyer);
  // const blockHeight = await currentBlock();

  // // Get listed Box from explorer
  // let listedBox = await getListedBox(buyBox);

  // let sellerValue = 0;
  // let payServiceFee = Math.floor(
  //   0.02 * listedBox.additionalRegisters.R4.renderedValue
  // );
  // if (payServiceFee === 0) {
  //   payServiceFee = 1;
  // }
  // // Get Royalty Values
  // // Get Royalty Values
  // let royalties: RoyaltyInterface | null = await getRoyaltyInfo(
  //   listedBox.assets[0].tokenId
  // );
  // let royalty_value;
  // let royalty_propBytes;
  // if (royalties?.artist) {
  //   royalty_value = Math.floor(
  //     (listedBox.additionalRegisters.R4.renderedValue * royalties.royalty) /
  //       1000
  //   );
  //   if (royalty_value === 0) {
  //     royalty_value = 1;
  //   }
  //   royalty_propBytes = royalties.artist;
  // }
  // sellerValue +=
  //   listedBox.additionalRegisters.R4.renderedValue -
  //   payServiceFee -
  //   (royalty_value ? royalty_value : 0);

  // const paySeller = {
  //   value: minBoxValue * 10,
  //   ergoTree: listedBox.additionalRegisters.R5.renderedValue,
  //   assets: [
  //     {
  //       tokenId: currencyId,
  //       amount: sellerValue.toString(),
  //     },
  //   ],
  //   creationHeight: blockHeight.height,
  //   additionalRegisters: {
  //     R4: await encodeHex(listedBox.boxId),
  //   },
  // };

  // const payService = {
  //   value: minBoxValue * 10,
  //   ergoTree: wasm.Address.from_mainnet_str(serviceAddress)
  //     .to_ergo_tree()
  //     .to_base16_bytes(),
  //   assets: [
  //     {
  //       tokenId: currencyId,
  //       amount: payServiceFee.toString(),
  //     },
  //   ],
  //   creationHeight: blockHeight.height,
  //   additionalRegisters: {},
  // };

  // let payRoyalty;
  // if (royalty_value) {
  //   payRoyalty = {
  //     value: minBoxValue * 15,
  //     ergoTree: wasm.Address.from_mainnet_str(royalty_propBytes)
  //       .to_ergo_tree()
  //       .to_base16_bytes(),
  //     assets: [
  //       {
  //         tokenId: currencyId,
  //         amount: royalty_value.toString(),
  //       },
  //     ],
  //     creationHeight: blockHeight.height,
  //     additionalRegisters: {},
  //   };
  // }

  // const buyerGets = {
  //   value: listedBox.value.toString(),
  //   ergoTree: wasm.Address.from_mainnet_str(buyer)
  //     .to_ergo_tree()
  //     .to_base16_bytes(),
  //   assets: [
  //     {
  //       tokenId: listedBox.assets[0].tokenId,
  //       amount: listedBox.assets[0].amount.toString(),
  //     },
  //   ],
  //   creationHeight: blockHeight.height,
  //   additionalRegisters: {},
  // };

  // const feeBox = {
  //   value: txFee.toString(),
  //   creationHeight: blockHeight.height,
  //   ergoTree:
  //     "1005040004000e36100204a00b08cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ea02d192a39a8cc7a701730073011001020402d19683030193a38cc7b2a57300000193c2b2a57301007473027303830108cdeeac93b1a57304",
  //   assets: [],
  //   additionalRegisters: {},
  // };

  // let requiredErg =
  //   parseInt(payService.value) +
  //   parseInt(buyerGets.value) +
  //   parseInt(feeBox.value) +
  //   parseInt(paySeller.value);
  // if (royalty_value)
  //   requiredErg = parseInt(requiredErg) + parseInt(payRoyalty.value);

  // let need = { ERG: requiredErg };
  // need[currencyId] = parseInt(listedBox.additionalRegisters.R4.renderedValue);
  // // Get all wallet tokens/ERG and see if they have enough
  // let have = JSON.parse(JSON.stringify(need));
  // have["ERG"] += txFee;
  // let ins: any[] = [];
  // const keys = Object.keys(have);

  // const allBal = await getTokens();
  // if (
  //   keys
  //     .filter((key) => key !== "ERG")
  //     .filter(
  //       (key) =>
  //         !Object.keys(allBal).includes(key) || allBal[key].amount < have[key]
  //     ).length > 0
  // ) {
  //   return "Not enough balance in the wallet! See FAQ for more info.";
  // }

  // for (let i = 0; i < keys.length; i++) {
  //   if (have[keys[i]] <= 0) continue;
  //   const curIns = await ergo.get_utxos(have[keys[i]].toString(), keys[i]);
  //   if (curIns !== undefined) {
  //     curIns.forEach((bx: any) => {
  //       have["ERG"] -= parseInt(bx.value);
  //       bx.assets.forEach((ass: any) => {
  //         if (!Object.keys(have).includes(ass.tokenId)) have[ass.tokenId] = 0;
  //         have[ass.tokenId] -= parseInt(ass.amount);
  //       });
  //     });
  //     ins = ins.concat(curIns);
  //   }
  // }
  // if (keys.filter((key) => have[key] > 0).length > 0) {
  //   return "Not enough balance in the wallet! See FAQ for more info.";
  // }

  // const changeBox = {
  //   value: (-have["ERG"] + listedBox.value + txFee).toString(),
  //   ergoTree: wasm.Address.from_mainnet_str(buyer)
  //     .to_ergo_tree()
  //     .to_base16_bytes(),
  //   assets: Object.keys(have)
  //     .filter((key) => key !== "ERG")
  //     .filter((key) => have[key] < 0)
  //     .map((key) => {
  //       return {
  //         tokenId: key,
  //         amount: (-have[key]).toString(),
  //       };
  //     }),
  //   additionalRegisters: {},
  //   creationHeight: blockHeight.height,
  // };

  // if (changeBox.assets.length > CHANGE_BOX_ASSET_LIMIT) {
  //   throw "Too many NFTs in input boxes to form single change box. Please de-consolidate some UTXOs. Contact the team on discord for more information.";
  // } else {
  //   let finalOutputs = [paySeller, payService];
  //   if (payRoyalty) {
  //     finalOutputs.push(payRoyalty);
  //   }
  //   finalOutputs.push(buyerGets);
  //   finalOutputs.push(changeBox);
  //   finalOutputs.push(feeBox);

  //   const inputList = ins.map((curIn) => {
  //     return {
  //       ...curIn,
  //       extension: {},
  //     }; // this gets all user eutxo boxes
  //   });

  //   const inputBoxes = inputList.concat(listedBox);
  //   const transaction_to_sign = {
  //     inputs: inputBoxes,
  //     outputs: finalOutputs,
  //     dataInputs: [],
  //     fee: txFee,
  //   };

  //   return await signTx(transaction_to_sign);
  // }
}
