import { getListedBox } from "../helpers";
import { txFee, CHANGE_BOX_ASSET_LIMIT } from "../consts";
import { min_value } from "../conf";
import { currentBlock } from "../explorer";
import { encodeHex } from "../serializer";
import { get_utxos } from "../utxos";

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
  currency: string;
  userAddresses: string[];
}

export async function refund({ cancelBox, userAddresses }: RelistInterface) {
  const wasm = await ergolib;

  const refundIssuer = userAddresses[0];
  const blockHeight = await currentBlock();

  let listedBox = await getListedBox(cancelBox);
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

    // if (getWalletType() === "ergopay") {
    //   const txId = await axios.post(`${skyHarborApi}/api/ergopay/saveTx`, {
    //     // sendAddress: sendAddress,

    //     txData: unsignedTx,
    //     uuid: getWalletUUID(),
    //   });
    //   console.log("unsigned txId", txId.data);
    //   return txId.data;
    // } else {
    // if not ergopay
    //   return await signTx(transaction_to_sign);
    // }

    return transaction_to_sign;
  }

  // ***************** IF BOX DOES NOT HAVE ENOUGH TO COVER FEES, TAKE FEES FROM USER *****************
  else {
    let need = { ERG: min_value };
    // Get all wallet tokens/ERG and see if they have enough
    let have = JSON.parse(JSON.stringify(need));
    have["ERG"] += txFee;
    let ins: any = [];
    const keys = Object.keys(have);

    for (let i = 0; i < keys.length; i++) {
      if (have[keys[i]] <= 0) continue;
      let curIns;
      // Without dapp connector
      if (keys[i] === "ERG") {
        curIns = await get_utxos(refundIssuer, have[keys[i]].toString());
      } else {
        curIns = await get_utxos(
          refundIssuer,
          0,
          keys[i],
          have[keys[i]].toString()
        );
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
      showMsg("Not enough balance in the wallet! See FAQ for more info.", true);
      return;
    }

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
      showMsg(
        "Too many NFTs in input boxes to form single change box. Please de-consolidate some UTXOs. Contact the team on discord for more information.",
        true
      );
      return;
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

      const inputList = ins.map((curIn) => {
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

      // CODE BELOW DOES NOT WORK AS IT RESTRUCTURES LISTEDBOX

      // ***** BUILD ENTIRE TRANSACTION *****
      // const unsignedTransaction = new TransactionBuilder(blockHeight.height)
      // .from(inputBoxes)
      // .to([changeBox])
      // .sendChangeTo(refundIssuer)
      // .payMinFee()
      // .build()
      // .toEIP12Object()

      const unsignedTx = JSON.stringify(transaction_to_sign);
      console.log("unsignedTxunsignedTx: ", unsignedTx);

      //   if (getWalletType() === "ergopay") {
      //     const txId = await axios.post(`${skyHarborApi}/api/ergopay/saveTx`, {
      //       // sendAddress: sendAddress,

      //       txData: unsignedTx,
      //       uuid: getWalletUUID(),
      //     });
      //     console.log("unsigned txId", txId.data);
      //     return txId.data;
      //   } else {
      //     // if not ergopay
      //     return await signTx(transaction_to_sign);
      //   }

      return transaction_to_sign;
    }
  }
}
