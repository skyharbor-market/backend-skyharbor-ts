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
router.get(["/bulkList", "/list"], async (req: Request, res: Response) => {
  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  const body: RequestBody = req.body;
  if (body === undefined) {
    return 400001;
  } else if (body.nfts === undefined) {
    return 400002;
  } else if (checkIfAssetsAreCorrect(body.nfts)) {
    res.status(400);
    res.send({ message: "One of your body.nfts objects are built wrong. Must include id, price, and currency." });

    return 400003;

  } else if (
    body.userAddresses === undefined ||
    body.userAddresses.length === 0
  ) {
    return 400004;
  } else if (body.price === undefined) {
    return 400005;
  } else if (body.currency === undefined) {
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
  if (typeof body.nfts === "object") {
    allNfts = body.nfts;
  } else {
    allNfts = [body.nfts];
  }

  const transaction_to_sign = await bulkList({
    nfts: allNfts,
    userAddresses: body.userAddresses,
    price: body.price,
    currency: body.currency,
  });

  return transaction_to_sign;
});

export default router;


function checkIfAssetsAreCorrect(nft: NftAsset | NftAsset[]) {
  let allNfts: NftAsset[]
  if(!Array.isArray(nft)) {
    allNfts = [nft]
  }
  else {
    allNfts = nft;
  }

  for(let n of allNfts) {
    if(!n.id || !n.price || !n.currency) {
      return false
    }
  }

  return true
}