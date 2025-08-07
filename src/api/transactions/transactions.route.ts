import express from "express";
import cors from "cors";
import { postBuyNFT } from "../../ergofunctions/transactions/buyNFT";
import { postBulkList } from "../../ergofunctions/transactions/bulkList";
import { postEditNFT } from "../../ergofunctions/transactions/relistNFT";
import { postDelistNFT } from "../../ergofunctions/transactions/refund";

const router = express.Router();

// CORS configuration - allow all origins
const corsOptions: cors.CorsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
  ],
  methods: 'GET,OPTIONS,POST',
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Handle OPTIONS preflight requests
router.options('*', cors(corsOptions));

// Eventually add API caching for speed, and API keys for usage

// Bulk List and Single List are same method currently
router.post(["/bulkList", "/list"], cors(corsOptions), postBulkList);

router.post(["/buy"], cors(corsOptions), postBuyNFT);

router.post(["/delist"], cors(corsOptions), postDelistNFT);

router.post(["/edit"], cors(corsOptions), postEditNFT);

export default router;