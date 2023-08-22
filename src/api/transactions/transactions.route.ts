import express, { Request, Response } from "express";
import { Error } from "../../classes/error";
import { allowedCurrencies } from "../../ergofunctions/consts";
import { bulkList } from "../../ergofunctions/transactions/bulkList";
import NftAsset from "../../interfaces/NftAsset";

const router = express.Router();

// Eventually add API caching for speed, and API keys for usage

interface RequestBody {
  nfts: NftAsset[];
  userAddresses: string[];
  price: number;
  currency: string;
}

// Bulk List and Single List are same method currently
router.post(["/bulkList", "/list"], async (req: Request, res: Response) => {
  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  const body: RequestBody = req.body;
  console.log("BODY:", body);

  if (body === undefined) {
    res.status(400);
    res.send({
      message: "API requires a body.",
    });
    return 400001;
  } else if (body.nfts === undefined) {
    return 400002;
  } else if (!checkIfAssetsAreCorrect(body.nfts)) {
    res.status(400);
    res.send({
      message:
        "One of your body.nfts objects are built wrong. Must include id, price, and currency.",
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
  } else if (body.price === undefined) {
    res.status(400);
    res.send({
      message: "body.price is not found.",
    });

    return 400005;
  } else if (body.currency === undefined) {
    res.status(400);
    res.send({
      message: "body.currency is not found.",
    });

    return 400006;
  } else if (!allowedCurrencies.includes(body.currency)) {
    // currency not found in allowed currencies
    res.status(400);
    res.send({ message: "body.currency not found in allowed currencies." });
    return 400007;
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
      price: body.price,
      currency: body.currency,
    });
  } catch (err) {
    res.status(400);
    res.send({ 
      error: true,
      message: err
     });
     return
  }

  // return transaction_to_sign;
  res.status(200);
  res.send({ 
    error: false,
    transaction_to_sign: transaction_to_sign
  });
  return
});

export default router;

function checkIfAssetsAreCorrect(nft: NftAsset | NftAsset[]) {
  let allNfts: NftAsset[];

  if (!Array.isArray(nft)) {
    allNfts = [nft];
  } else {
    allNfts = nft;
  }

  for (let n of allNfts) {
    if (!n.id || !n.price || !n.currency) {
      return false;
    }
  }

  return true;
}
