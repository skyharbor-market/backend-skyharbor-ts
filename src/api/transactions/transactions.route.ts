import express, { Request, Response } from "express";
import { Error } from "../../classes/error";
import { bulkList } from "../../ergofunctions/transactions/bulkList";

const router = express.Router();

// Eventually add API caching for speed, and API keys for usage

// Bulk List and Single List are same method currently
router.get(["/bulkList", "/list"], async (req: Request, res: Response) => {
  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  // This API call need:
  // nfts: All NFTs they are listing (even if only just 1)
  // userAddresses: All user addresses so we can look through all and check if they have balance
  // price: Cost of all NFTs being listed
  // currency: Currency of the listing price

  const colls = await bulkList({
    nfts: [],
    userAddresses: [],
    price: 1,
    currency: "",
  });

  if (typeof colls !== "undefined") {
    // console.log("collections" + collections)
    if (colls instanceof Error) {
      res.status(colls.httpCode);
      res.send(colls.text);
    } else {
      res.status(200);
      res.send(colls.rows);
    }
  } else {
    var resp = {
      message: "Call failed!",
    };
    res.status(500);
    res.send(resp);
  }
});

export default router;
