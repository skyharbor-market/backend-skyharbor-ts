import express, { Request, Response } from "express";
import { postBuyNFT } from "../../ergofunctions/transactions/buyNFT";
import { postBulkList } from "../../ergofunctions/transactions/bulkList";
import { postEditNFT } from "../../ergofunctions/transactions/relistNFT";
import { postDelistNFT } from "../../ergofunctions/transactions/refund";

const router = express.Router();

// Handle OPTIONS preflight requests for CORS
router.options('*', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Eventually add API caching for speed, and API keys for usage

// Bulk List and Single List are same method currently
router.post(["/bulkList", "/list"], postBulkList);

router.post(["/buy"], postBuyNFT);

router.post(["/delist"], postDelistNFT);

router.post(["/edit"], postEditNFT);

export default router;