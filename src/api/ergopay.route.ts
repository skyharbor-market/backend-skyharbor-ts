import express, { Request, Response } from "express"
import { ergoPayPool } from "../server"
import { PoolClient, QueryResult } from "pg"
import { ErgoPayResponse, Severity, ErgoPayReply } from "../classes/ergopay"
import cors from "cors"
import { byteArrayToBase64 } from "../ergofunctions/serializer"
import { getLastHeaders } from "../ergofunctions/explorer"
import JSONBigInt from "json-bigint"
import {
  BlockHeaders,
  ErgoBoxes,
  ErgoStateContext,
  PreHeader,
  ReducedTransaction,
  UnsignedTransaction
} from "ergo-lib-wasm-nodejs"

const router = express.Router();

// router.get('/schema', async (req: Request, res: Response) => {
// })

const origins = ['https://skyharbor.io', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://testapi.skyharbor.io']
const options: cors.CorsOptions = {
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
router.options('*', cors(options), async (req: Request, res: Response) => {
  res.status(200);
});

router.post('/saveTx', cors(options), async (req: Request, res: Response) => {

  let resp = await saveTx(req.body, req.query);

  if (typeof resp !== "undefined") {

    console.log("resp: " + resp)

    if (typeof resp === "number") {
      if (resp === 400001) {
        res.status(400);
        res.send({ "message": "no ?query params given." });
      } else if (resp === 400002) {
        res.status(400);
        res.send({ "message": "body.uuid missing in POST payload." });
      } else if (resp === 400003) {
        res.status(400);
        res.send({ "message": "no ?body supplied." });
      } else if (resp === 400004) {
        res.status(400);
        res.send({ "message": "body.txData missing in POST payload." });
      } else if (resp === 500000) {
        res.status(500);
        res.send({ "message": "Call failed, can devs do something?!" });
      }
    } else {
      res.status(200);
      // send txId back
      res.send(resp);
    }
  } else {
    res.status(500);
    res.send({ "message": "Call failed!" });
  }

})

router.route("/setAddr/:uuid/:addr").get(cors(options), async (req: Request, res: Response): Promise<void> => {
  const uuid = req.params.uuid || ""
  const addr = req.params.addr || ""
  let response = new ErgoPayResponse()
  let dbResp: QueryResult<any> | number

  const dbQuery = `insert into active_sessions values (default,$$${uuid}$$,current_timestamp,$$${addr}$$) on conflict on constraint unique_uuid do update set last_connect_time = current_timestamp, wallet_address = $$${addr}$$;`

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    console.log("error saving ergopay wallet address to DB")
    response.message = `error saving ergopay wallet address to DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  if (typeof dbResp === "number") {
    response.message = `error saving ergopay wallet address to DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  response.address = addr
  response.message = `Successfully connected wallet address ${addr} to SkyHarbor.\n\nYou can now continue using Ergo's #1 Marketplace.`
  response.messageSeverity = Severity.INFORMATION
  res.status(200).json(response);

})

router.route("/getWalletAddr/:uuid").get(cors(options), async (req: Request, res: Response): Promise<void> => {
  const uuid = req.params.uuid || ""
  let addr = ""
  let dbResp: QueryResult<any> | number

  const dbQuery = `select wallet_address from active_sessions where uuid = '${uuid}';`

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    console.log("error getting client wallet address from DB")
    res.status(200).json({ error: "error getting client wallet address from DB", walletAddr: "" });
    return
  }

  if (typeof dbResp === "number") {
    res.status(200).json({ error: "error getting client wallet address from DB", walletAddr: "" });
    return
  }

  if (dbResp.rows.length === 0) {
    res.status(200).json({ error: `client wallet address for uuid ${uuid} is missing from DB`, walletAddr: "" });
    return
  }

  console.log(dbResp)
  res.status(200).json({ error: "", walletAddr: dbResp.rows[0] });

})

router.route("/getTx/:txId/:addr").get(cors(options), async (req: Request, res: Response): Promise<void> => {
  const txId = req.params.txId || ""
  const addr = req.params.addr || ""
  let response = new ErgoPayResponse()
  let dbResp: QueryResult<any> | number

  const dbQuery = `select tx_data from pay_requests where tx_id = '${txId}';`

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    console.log("error getting txReducedB64safe from DB")
    response.message = `error getting txReducedB64safe from DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  if (typeof dbResp === "number") {
    response.message = `error getting txReducedB64safe from DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  if (dbResp.rows.length === 0) {
    response.message = `Tx ${txId} is missing from the DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  console.log(dbResp)
  response.reducedTx = dbResp.rows[0].tx_data
  response.address = addr
  response.message = `Your NFT purchase is ready to be signed`
  response.messageSeverity = Severity.INFORMATION
  response.replyTo = `https://testapi.skyharbor.io/api/ergopay/signed`
  res.status(200).json(response);

})

router.route("/signed").post(cors(options), async (req: Request, res: Response): Promise<void> => {
  const txId = req.params.txId || ""
  let response = new ErgoPayResponse()
  let reply = {} as ErgoPayReply
  let dbResp: QueryResult<any> | number

  console.log(req)
  try {
    reply = req.body as ErgoPayReply
  } catch (e) {
    console.log("failed to parse ErgoPayReply")
    response.message = `failed to parse ErgoPayReply, this doesn't mean your transaction failed.`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  const dbQuery = `update pay_requests set signed = true where tx_id = '${reply.txId}';`

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    console.log("error updating signed column in DB")
    response.message = `error updating signed column in DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  if (typeof dbResp === "number") {
    response.message = `error updating signed column in DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  console.log(dbResp)
  response.message = `Thank you for your purchase!`
  response.messageSeverity = Severity.INFORMATION
  res.status(200).json(response);

})

async function executeDBQuery(query: string): Promise<QueryResult<any> | number> {

  return new Promise(resolve => {

    ergoPayPool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err;

      console.log("query text: " + query);

      if (typeof query !== "number") {
        client
          .query(query)
          .then(res => {
            release();
            resolve(res);
          })
          .catch(e => {
            release();
            console.error(e.stack)
            resolve(500000);
          })
      } else { //rtn error code
        release()
        resolve(query);
      }
    })
  });
}

async function saveTx(body: any, query: any): Promise<string | number> {

  return new Promise(resolve => {

    ergoPayPool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err;

      let [txId, queryText] = await getTxDataQueryText(body, query);

      console.log("query text: " + queryText);

      if (typeof queryText !== "number") {
        // check if txId already exists in DB
        let res: QueryResult<any>
        try {
          res = await client.query(`select tx_id, signed from pay_requests where tx_id = '${txId}';`)
          if (res.rowCount > 0) {
            release()
            resolve(txId)
          }
          // Add new reduced tx to DB
          client
            .query(queryText)
            .then(res => {
              release();
              resolve(txId);
            })
            .catch(e => {
              release();
              console.error(e.stack)
              resolve(500000);
            })
        } catch (e) {
          release();
          console.error(e.stack)
          resolve(500000);
        }
      } else { //rtn error code
        release()
        resolve(queryText);
      }
    })
  });
}


async function getTxDataQueryText(body: any, query: any): Promise<[string, string | number]> {

  let queryText = ""
  let txId = ""

  if (body.uuid === undefined) {
    return [txId, 400002]
  } else if (body === undefined) {
    return [txId, 400003]
  } else if (body.txData === undefined) {
    return [txId, 400004]
  } else {
    // reduce base64 the tx before saving to the DB
    const bodyParam = JSONBigInt.parse(body.txData)
    const unsignedTx = UnsignedTransaction.from_json(JSONBigInt.stringify(bodyParam))
    const inputBoxes = ErgoBoxes.from_boxes_json(bodyParam.inputs)
    const inputDataBoxes = ErgoBoxes.from_boxes_json(bodyParam.dataInputs)

    txId = unsignedTx.id().to_str()

    const block_headers = BlockHeaders.from_json(await getLastHeaders())
    const pre_header = PreHeader.from_block_header(block_headers.get(0))
    const ctx = new ErgoStateContext(pre_header, block_headers)

    const reducedTx = ReducedTransaction.from_unsigned_tx(unsignedTx, inputBoxes, inputDataBoxes, ctx)

    const txReducedBase64 = Buffer.from(reducedTx.sigma_serialize_bytes()).toString('base64');    //byteArrayToBase64(reducedTx.sigma_serialize_bytes())
    const ergoPayTx = txReducedBase64.replace(/\//g, '_').replace(/\+/g, '-')

    queryText = `insert into pay_requests values (default,$$${body.uuid}$$,$$${ergoPayTx}$$,current_timestamp,$$${txId}$$) ;`

  }
  return [txId, queryText]
}


router.post('/saveSession', async (req: Request, res: Response) => {

  var resp = await saveSession(req.body, req.query);

  if (typeof resp !== "undefined") {

    console.log("resp: " + resp)

    if (typeof resp === "number") {
      if (resp === 400001) {
        res.status(400);
        res.send({ "message": "no ?query params given." });
      } else if (resp === 400002) {
        res.status(400);
        res.send({ "message": "no ?uuid query param given." });
      } else if (resp === 400003) {
        res.status(400);
        res.send({ "message": "no ?body supplied." });
      } else if (resp === 500000) {
        res.status(500);
        res.send({ "message": "Call failed, can devs do something?!" });
      }
    } else {
      res.status(200);
      res.send(resp.rows);
    }
  } else {
    res.status(500);
    res.send({ "message": "Call failed!" });
  }

})


async function saveSession(body: any, query: any): Promise<QueryResult<any> | number> {

  return new Promise(resolve => {

    ergoPayPool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err;

      let queryText = await getSaveSessionQueryText(body, query);

      console.log("query text: " + queryText);

      if (typeof queryText !== "number") {
        client
          .query(queryText)
          .then(res => {
            release();
            resolve(res);
          })
          .catch(e => {
            release();
            console.error(e.stack)
            resolve(500000);
          })
      } else { //rtn error code
        release()
        resolve(queryText);
      }
    })
  });
}

async function getSaveSessionQueryText(body: any, query: any): Promise<string | number> {

  let queryText = ""

  if (typeof query === "undefined") {
    return 400001
  } else {

    if (query.uuid === undefined) {
      return 400002
    } else if (body === undefined) {
      return 400003
    } else if (body.wallet === undefined) {
      return 400003

    } else {
      queryText = `insert into active_sessions values (default,$$${query.uuid}$$,current_timestamp,$$${body.wallet}$$) on conflict on constraint unique_uuid do update set last_connect_time = current_timestamp, wallet_address = $$${body.wallet}$$;`
    }
    return queryText
  }
}

export default router