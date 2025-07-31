import { getListedBox } from "../helpers";
import { txFee, CHANGE_BOX_ASSET_LIMIT } from "../consts";
import { currentBlock } from "../explorer";
import { encodeHex, getRoyaltyInfo, RoyaltyInterface } from "../serializer";
import { get_utxos, collectRequiredInputs } from "../utxos";
import { addressIsValid } from "../../functions/validationChecks";
import NftAsset from "../../interfaces/NftAsset";
import { BuyBoxInterface } from "../../interfaces/BuyBox";
import { Request, Response } from "express";

let ergolib = import("ergo-lib-wasm-nodejs");

// const nodeUrl = "https://paidincrypto.io";
// const nodeUrl = "https://www.test-skyharbor-server.net:9053/";
const nodeUrl = "https://node.ergo.watch";
// new open node at https://node.ergo.watch/

const serviceAddress = "9h9ssEYyHaosFg6BjZRRr2zxzdPPvdb7Gt7FA8x7N9492nUjpsd";
const minterServiceAddress =
  "9h9ssEYyHaosFg6BjZRRr2zxzdPPvdb7Gt7FA8x7N9492nUjpsd";

// -------------------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------- Buying an NFT -----------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------

interface BuyInterface {
  buyBox: BuyBoxInterface;
  userAddresses: string[]; //All user addresses so we can look through all and check if they have balance
}

export async function buyNFT({ buyBox, userAddresses }: BuyInterface) {
  const wasm = await ergolib;

  // Validate all addresses
  for (const address of userAddresses) {
    const isValidAdd = await addressIsValid(address);
    if (!isValidAdd) {
      console.log("invalid address:", address);
      throw `Address ${address} is not valid`;
    }
  }
  
  // Use first address as the primary buyer address for outputs
  const buyer = userAddresses[0];
  console.log("buyer", buyer);
  console.log("using", userAddresses.length, "addresses for inputs");

  const blockHeight = await currentBlock();
  let listedBox;
  try {
    listedBox = await getListedBox(buyBox);

  } catch (err) {
    console.log("ERRRE", err);
    throw "Error getting NFT listing."
  }

  // Calculate Box Values
  let sellerValue = 0;
  let payServiceFee = Math.floor(
    0.02 * listedBox.additionalRegisters.R4.renderedValue
  );
  if (payServiceFee === 0) {
    payServiceFee = 1;
  }
  let royalties: RoyaltyInterface | null = await getRoyaltyInfo(
    listedBox.assets[0].tokenId
  );
  let royalty_value;
  let royalty_propBytes;
  if (royalties?.artist) {
    royalty_value = Math.floor(
      (listedBox.additionalRegisters.R4.renderedValue *
        (royalties?.royalty || 0)) /
        1000
    );
    if (royalty_value === 0) {
      royalty_value = 1;
    }
    royalty_propBytes = royalties.artist;
  }

  sellerValue +=
    listedBox.additionalRegisters.R4.renderedValue -
    payServiceFee -
    (royalty_value ? royalty_value : 0);

  const paySeller = {
    value: sellerValue.toString(),
    ergoTree: listedBox.additionalRegisters.R5.renderedValue,
    assets: [],
    creationHeight: blockHeight.height,
    additionalRegisters: {
      R4: await encodeHex(listedBox.boxId),
    },
  };

  const payService = {
    value: payServiceFee,
    ergoTree: wasm.Address.from_mainnet_str(serviceAddress)
      .to_ergo_tree()
      .to_base16_bytes(),
    assets: [],
    creationHeight: blockHeight.height,
    additionalRegisters: {},
  };

  let payRoyalty;
  if (royalty_value && royalty_propBytes) {
    payRoyalty = {
      value: royalty_value,
      ergoTree: wasm.Address.from_mainnet_str(royalty_propBytes)
        .to_ergo_tree()
        .to_base16_bytes(),
      assets: [],
      creationHeight: blockHeight.height,
      additionalRegisters: {},
    };
  }

  const buyerGets = {
    value: listedBox.value.toString(),
    ergoTree: wasm.Address.from_mainnet_str(buyer)
      .to_ergo_tree()
      .to_base16_bytes(),
    assets: [
      {
        tokenId: listedBox.assets[0].tokenId,
        amount: listedBox.assets[0].amount,
      },
    ],
    creationHeight: blockHeight.height,
    additionalRegisters: {},
  };

  console.log("test 2");


  const feeBox = {
    value: txFee.toString(),
    creationHeight: blockHeight.height,
    ergoTree:
      "1005040004000e36100204a00b08cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ea02d192a39a8cc7a701730073011001020402d19683030193a38cc7b2a57300000193c2b2a57301007473027303830108cdeeac93b1a57304",
    assets: [],
    additionalRegisters: {},
  };

  const requiredErg =
    parseInt(listedBox.additionalRegisters.R4.renderedValue) +
    parseInt(buyerGets.value) +
    parseInt(feeBox.value);
  let need = { ERG: requiredErg };
  // Get all wallet tokens/ERG from all addresses and see if they have enough
  const inputResult = await collectRequiredInputs(userAddresses, need, txFee);
  
  if (!inputResult.success) {
    throw "Not enough balance in the wallet! See FAQ for more info";
  }
  
  const ins = inputResult.inputs;
  const have = inputResult.have;

  console.log("test 3");


  const changeBox = {
    value: (-have["ERG"] + listedBox.value + txFee).toString(),
    ergoTree: wasm.Address.from_mainnet_str(buyer)
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
    return;
  } else {
    let finalOutputs = [paySeller, payService];
    if (payRoyalty) {
      finalOutputs.push(payRoyalty);
    }
    // @ts-ignore
    finalOutputs.push(buyerGets);
    // @ts-ignore
    finalOutputs.push(changeBox);
    // @ts-ignore
    finalOutputs.push(feeBox);

    const inputList = ins.map((curIn) => {
      return {
        ...curIn,
        extension: {},
      }; // this gets all user eutxo boxes
    });
    const inputBoxes = inputList.concat(listedBox);
    const transaction_to_sign = {
      inputs: inputBoxes,
      outputs: finalOutputs,
      dataInputs: [],
      fee: txFee,
    };

    // return await signTx(transaction_to_sign)
    return transaction_to_sign;
  }
}


// BUY NFT
interface BuyRequestBody {
  buyBox: BuyBoxInterface;
  userAddresses: string[];
}

export async function postBuyNFT(req: Request, res: Response) {

  const body: BuyRequestBody = req.body;
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
  } else if (body.buyBox === undefined) {
    res.status(400);
    res.send({
      message: "body.buyBox not found.",
    });
    return 400002;
  } else if (
    body.userAddresses === undefined ||
    body.userAddresses.length === 0
  ) {
    res.status(400);
    res.send({
      message: "body.userAddresses is not found.",
    });
    return 400003;
  }

  let transaction_to_sign;
  try {
    transaction_to_sign = await buyNFT({
      buyBox: body.buyBox,
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

  // return transaction_to_sign;
  res.status(200);
  res.send({
    error: false,
    transaction_to_sign: transaction_to_sign,
  });
  return;
};