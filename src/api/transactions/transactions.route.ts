import express, { Request, Response } from "express";
import cors from "cors";
import { postBuyNFT } from "../../ergofunctions/transactions/buyNFT";
import { postBulkList } from "../../ergofunctions/transactions/bulkList";
import { postEditNFT } from "../../ergofunctions/transactions/relistNFT";
import { postDelistNFT } from "../../ergofunctions/transactions/refund";

const router = express.Router();

// CORS configuration
const corsOptions = {
  origin: '*',
  credentials: true,
  methods: 'POST, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization'
};

// Handle OPTIONS preflight requests for CORS
router.options('*', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Eventually add API caching for speed, and API keys for usage

// Bulk List and Single List are same method currently
router.post(["/bulkList", "/list"], cors(corsOptions), postBulkList);

router.post(["/buy"], cors(corsOptions), postBuyNFT);

router.post(["/delist"], cors(corsOptions), postDelistNFT);

router.post(["/edit"], cors(corsOptions), postEditNFT);

export default router;