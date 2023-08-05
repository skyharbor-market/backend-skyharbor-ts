import express, { Request, Response } from "express";
import { Error } from "../../classes/error";
import { bulkList } from "../../ergofunctions/transactions/bulkList";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  const colls = await bulkList(req.query);

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
