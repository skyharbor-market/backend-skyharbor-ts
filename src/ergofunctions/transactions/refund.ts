import { getListedBox } from "../helpers";
import { txFee, CHANGE_BOX_ASSET_LIMIT } from "../consts";
import { min_value } from "../conf";
import { currentBlock } from "../explorer";
import { encodeHex } from "../serializer";
import { get_utxos, collectRequiredInputs } from "../utxos";
import { BuyBoxInterface } from "../../interfaces/BuyBox";
import { Request, Response } from "express";

let ergolib = import("ergo-lib-wasm-nodejs");

// const nodeUrl = "https://paidincrypto.io";
// const nodeUrl = "https://www.test-skyharbor-server.net:9053/";
const nodeUrl = "https://node.ergo.watch";
// new open node at https://node.ergo.watch/

// -------------------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------- Refund an NFT -----------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------

interface RelistInterface {
  cancelBox: any;
  userAddresses: string[];
}

export async function refund({ cancelBox, userAddresses }: RelistInterface) {
  const wasm = await ergolib;

  // Use first address as the primary refund issuer address for outputs
  const refundIssuer = userAddresses[0];
  console.log("using", userAddresses.length, "addresses for refund");
  const blockHeight = await currentBlock();


  let tempBox = cancelBox
  if(typeof cancelBox === "string") {
    tempBox = {
      box_id: cancelBox
    }
  }

  let listedBox = await getListedBox(tempBox);
  listedBox.additionalRegisters.R4 =
    listedBox.additionalRegisters.R4?.serializedValue ||
    listedBox.additionalRegisters.R4;
  listedBox.additionalRegisters.R5 =
    listedBox.additionalRegisters.R5?.serializedValue ||
    listedBox.additionalRegisters.R5;
  listedBox.additionalRegisters.R7 =
    listedBox.additionalRegisters.R7?.serializedValue ||
    listedBox.additionalRegisters.R7;

  // IF BOX HAS ENOUGH VALUE TO COVER FEES
  console.log("txFee + min_value", txFee + min_value);
  if (listedBox.value === txFee + min_value) {
    // ChangeBox is change + refunded box
    let changeBox = {
      value: min_value.toString(),
      ergoTree: wasm.Address.from_mainnet_str(refundIssuer)
        .to_ergo_tree()
        .to_base16_bytes(),
      assets: [
        {
          tokenId: listedBox.assets[0].tokenId,
          amount: listedBox.assets[0].amount,
        },
      ],
      additionalRegisters: {
        R4: await encodeHex(listedBox.boxId),
      },
      creationHeight: blockHeight.height,
    };

    const feeBox = {
      value: txFee.toString(),
      creationHeight: blockHeight.height,
      ergoTree:
        "1005040004000e36100204a00b08cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ea02d192a39a8cc7a701730073011001020402d19683030193a38cc7b2a57300000193c2b2a57301007473027303830108cdeeac93b1a57304",
      assets: [],
      additionalRegisters: {},
    };

    const transaction_to_sign = {
      inputs: [listedBox],
      outputs: [changeBox, feeBox],
      dataInputs: [],
      fee: txFee,
    };

    const unsignedTx = JSON.stringify(transaction_to_sign);

    return transaction_to_sign;
  }

  // ***************** IF BOX DOES NOT HAVE ENOUGH TO COVER FEES, TAKE FEES FROM USER *****************
  else {
    let need = { ERG: min_value };
    // Get all wallet tokens/ERG from all addresses and see if they have enough
    const inputResult = await collectRequiredInputs(userAddresses, need, txFee);
    
    if (!inputResult.success) {
      return "Not enough balance in the wallet! See FAQ for more info.";
    }
    
    const ins = inputResult.inputs;
    const have = inputResult.have;

    console.log("ins", ins);

    // ChangeBox is change + refunded box
    let changeBox = {
      value: (-have["ERG"] + min_value + listedBox.value).toString(),
      ergoTree: wasm.Address.from_mainnet_str(refundIssuer)
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
      additionalRegisters: {
        R4: await encodeHex(listedBox.boxId),
      },
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
      changeBox.assets.unshift({
        tokenId: listedBox.assets[0].tokenId,
        amount: listedBox.assets[0].amount,
      });

      const inputList = ins.map((curIn: any) => {
        return {
          ...curIn,
          extension: {},
        }; // this gets all user eutxo boxes
      });

      const inputBoxes = inputList.concat(listedBox);

      const transaction_to_sign = {
        inputs: inputBoxes,
        outputs: [changeBox, feeBox],
        dataInputs: [],
        fee: txFee,
      };

      const unsignedTx = JSON.stringify(transaction_to_sign);
      console.log("unsignedTxunsignedTx: ", unsignedTx);

      return transaction_to_sign;
    }
  }
}


interface CancelRequestBody {
  cancelBox: BuyBoxInterface;
  userAddresses: string[];
}

export async function postDelistNFT(req: Request, res: Response) {

  const body: CancelRequestBody = req.body;
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
  } else if (body.cancelBox === undefined) {
    res.status(400);
    res.send({
      message: "body.cancelBox not found.",
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
    transaction_to_sign = await refund({
      cancelBox: body.cancelBox,
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