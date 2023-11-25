import express from "express";
import { postBuyNFT } from "../../ergofunctions/transactions/buyNFT";
import { postBulkList } from "../../ergofunctions/transactions/bulkList";

const router = express.Router();

// Eventually add API caching for speed, and API keys for usage

// Bulk List and Single List are same method currently
router.post(["/bulkList", "/list"], postBulkList);

router.post(["/buy"], postBuyNFT);

router.post(["/delist"], postBuyNFT);

router.post(["/edit"], postEditNFT);

export default router;