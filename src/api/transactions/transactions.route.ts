import express, { Request, Response } from "express";
import { Error } from "../../classes/error";
import { allowedCurrencies } from "../../ergofunctions/consts";
import { checkIfAssetsAreCorrect } from "../../ergofunctions/helpers";
import { bulkList } from "../../ergofunctions/transactions/bulkList";
import { buyNFT } from "../../ergofunctions/transactions/buyNFT";
import { BuyBoxInterface } from "../../interfaces/BuyBox";
import NftAsset from "../../interfaces/NftAsset";
import { postBulkList } from "../../ergofunctions/transactions/bulkList";

const router = express.Router();

// Eventually add API caching for speed, and API keys for usage

// LIST NFT
interface ListRequestBody {
  nfts: NftAsset[];
  userAddresses: string[];
}
// Bulk List and Single List are same method currently
router.post(["/bulkList", "/list"], postBulkList);

// BUY NFT
interface BuyRequestBody {
  buyBox: BuyBoxInterface;
  userAddresses: string[];
}
router.post(["/buy"], async (req: Request, res: Response) => {
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
});

export default router;
