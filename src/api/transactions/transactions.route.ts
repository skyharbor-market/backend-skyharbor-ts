import express from "express";
import cors from "cors";
import { postBuyNFT } from "../../ergofunctions/transactions/buyNFT";
import { postBulkList } from "../../ergofunctions/transactions/bulkList";
import { postEditNFT } from "../../ergofunctions/transactions/relistNFT";
import { postDelistNFT } from "../../ergofunctions/transactions/refund";

const router = express.Router();

// CORS configuration to match ergopay route
const origins = [
  'https://skyharbor.io', 
  'https://www.skyharbor.io', 
  'https://v1.skyharbor.io',
  'https://www.v1.skyharbor.io',
  'http://localhost:3000', 
  'http://127.0.0.1:3000', 
  'https://testapi.skyharbor.io', 
  'https://api.skyharbor.io', 
  'https://skyharbor-git-development-enftexchange.vercel.app'
];

const corsOptions: cors.CorsOptions = {
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
  ],
  methods: 'GET,OPTIONS,POST',
  origin: origins,
  preflightContinue: false,
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