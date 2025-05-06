import express, { Request, Response } from "express"
import { ergoPayPool } from "../server"
import { PoolClient, QueryResult, QueryConfig } from "pg"
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
import logger from '../logger'

const router = express.Router();

// router.get('/schema', async (req: Request, res: Response) => {
// })

const origins = ['https://skyharbor.io', 'https://www.skyharbor.io', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://testapi.skyharbor.io', 'https://api.skyharbor.io', 'https://skyharbor-git-development-enftexchange.vercel.app']
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

    logger.info({ message: "ergopay saveTx called", response: resp, route: "/api/ergopay/saveTx" })

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

  const dbQuery: QueryConfig<any[]> = {
    text: 'insert into active_sessions values (default,$1,current_timestamp,$2) on conflict on constraint unique_uuid do update set last_connect_time = current_timestamp, wallet_address = $3',
    values: [`${uuid}`, `${addr}`, `${addr}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error saving ergopay wallet address to DB",
      db_query: dbQuery,
      route: "/api/ergopay/setAddr/:uuid/:addr",
      uuid: uuid,
      address: addr,
      error: e
    })
    response.message = `error saving ergopay wallet address to DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  if (typeof dbResp === "number") {
    logger.error({
      message: "error saving ergopay wallet address to DB",
      db_query: dbQuery,
      route: "/api/ergopay/setAddr/:uuid/:addr",
      uuid: uuid,
      address: addr
    })
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

  const dbQuery: QueryConfig<any[]> = {
    text: 'select wallet_address from active_sessions where uuid = $1',
    values: [`${uuid}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error getting client wallet address from DB",
      db_query: dbQuery,
      route: "/api/ergopay/getWalletAddr/:uuid",
      uuid: uuid,
      error: e
    })
    res.status(200).json({ error: "error getting client wallet address from DB", walletAddr: "" });
    return
  }

  if (typeof dbResp === "number") {
    logger.error({
      message: "error getting client wallet address from DB",
      db_query: dbQuery,
      route: "/api/ergopay/getWalletAddr/:uuid",
      uuid: uuid
    })
    res.status(200).json({ error: "error getting client wallet address from DB", walletAddr: "" });
    return
  }

  if (dbResp.rows.length === 0) {
    logger.error({
      message: "client wallet address missing from DB",
      db_query: dbQuery,
      route: "/api/ergopay/getWalletAddr/:uuid",
      uuid: uuid
    })
    res.status(200).json({ error: `client wallet address for uuid ${uuid} is missing from DB`, walletAddr: "" });
    return
  }

  res.status(200).json({ error: "", walletAddr: dbResp.rows[0] });

})

router.route("/getTx/:txId/:addr").get(cors(options), async (req: Request, res: Response): Promise<void> => {
  const txId = req.params.txId || ""
  const addr = req.params.addr || ""
  let response = new ErgoPayResponse()
  let dbResp: QueryResult<any> | number

  const dbQuery: QueryConfig<any[]> = {
    text: 'select tx_data from pay_requests where tx_id = $1',
    values: [`${txId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error getting txReducedB64safe from DB",
      db_query: dbQuery,
      route: "/getTx/:txId/:addr",
      tx_id: txId,
      address: addr,
      error: e
    })
    response.message = `error getting txReducedB64safe from DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  if (typeof dbResp === "number") {
    logger.error({
      message: "error getting txReducedB64safe from DB",
      db_query: dbQuery,
      route: "/getTx/:txId/:addr",
      tx_id: txId,
      address: addr
    })
    response.message = `error getting txReducedB64safe from DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  if (dbResp.rows.length === 0) {
    logger.error({
      message: "Tx missing from the DB",
      db_query: dbQuery,
      route: "/getTx/:txId/:addr",
      tx_id: txId,
      address: addr
    })
    response.message = `Tx ${txId} is missing from the DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  logger.info({
    message: "Tx found in DB",
    db_resp: dbResp,
    route: "/getTx/:txId/:addr",
    tx_id: txId,
    address: addr
  })
  response.reducedTx = dbResp.rows[0].tx_data
  response.address = addr
  response.message = `Your NFT purchase is ready to be signed`
  response.messageSeverity = Severity.INFORMATION
  response.replyTo = `https://api.skyharbor.io/api/ergopay/signed`
  res.status(200).json(response);

})

router.route("/signed").post(cors(options), async (req: Request, res: Response): Promise<void> => {
  const txId = req.params.txId || ""
  let response = new ErgoPayResponse()
  let reply = {} as ErgoPayReply
  let dbResp: QueryResult<any> | number

  try {
    reply = req.body as ErgoPayReply
  } catch (e) {
    logger.error({
      message: "failed to parse ErgoPayReply",
      request: req.body,
      route: "/signed",
      error: e
    })
    response.message = `failed to parse ErgoPayReply, this doesn't mean your transaction failed.`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  const dbQuery: QueryConfig<any[]> = {
    text: 'update pay_requests set signed = true where tx_id = $1',
    values: [`${reply.txId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery);
  } catch (e) {
    logger.error({
      message: "error updating signed column in DB",
      db_query: dbQuery,
      route: "/signed",
      error: e
    })
    response.message = `error updating signed column in DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  if (typeof dbResp === "number") {
    logger.error({
      message: "error updating signed column in DB",
      db_query: dbQuery,
      route: "/signed"
    })
    response.message = `error updating signed column in DB`
    response.messageSeverity = Severity.ERROR
    res.status(200).json(response);
    return
  }

  response.message = `Thank you for your purchase!`
  response.messageSeverity = Severity.INFORMATION
  res.status(200).json(response);

})

async function executeDBQuery(query: QueryConfig<any[]>): Promise<QueryResult<any> | number> {

  return new Promise(resolve => {

    ergoPayPool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err;

      if (typeof query !== "number") {
        client
          .query(query)
          .then(res => {
            release();
            resolve(res);
          })
          .catch(e => {
            release();
            logger.error({ message: "failed to execute DB query for ergopay", error: e.stack })
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

      if (typeof queryText !== "number") {
        // check if txId already exists in DB
        let res: QueryResult<any>
        try {
          const q =
            'select tx_id, signed from pay_requests where tx_id = $1'
          const vals = [`${txId}`]
          res = await client.query(q, vals)
          if (res.rowCount > 0) {
            logger.info({ message: "found duplicate(s) for txId", tx_id: txId })
            release()
            resolve(txId)
          } else {
            // Add new reduced tx to DB
            logger.info({ message: "adding ergopay tx data for txId", tx_id: txId })
            client
              .query(queryText)
              .then(res => {
                release()
                resolve(txId)
              })
              .catch(e => {
                release()
                logger.error({ message: "failed to save ergopay tx to DB", error: e.stack})
                resolve(500000)
              })
          }
        } catch (e) {
          release()
          logger.error({ message: "failed to save ergopay tx to DB", error: e.stack })
          resolve(500000)
        }
      } else { //rtn error code
        release()
        resolve(queryText)
      }
    })
  });
}


async function getTxDataQueryText(body: any, query: any): Promise<[string, QueryConfig<any[]> | number]> {

  let queryText: QueryConfig<any[]>
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

    queryText = {
      text: 'insert into pay_requests values (default,$1,$2,current_timestamp,$3)',
      values: [`${body.uuid}`, `${ergoPayTx}`, `${txId}`],
    }

  }
  return [txId, queryText]
}


router.post('/saveSession', async (req: Request, res: Response) => {

  var resp = await saveSession(req.body, req.query);

  if (typeof resp !== "undefined") {

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
      if (err) throw err

      let queryText = await getSaveSessionQueryText(body, query)

      if (typeof queryText !== "number") {
        client
          .query(queryText)
          .then(res => {
            release()
            resolve(res)
          })
          .catch(e => {
            release()
            logger.error({ message: "failed to save ergopay session to the DB", error: e.stack })
            resolve(500000)
          })
      } else { //rtn error code
        release()
        resolve(queryText)
      }
    })
  });
}

async function getSaveSessionQueryText(body: any, query: any): Promise<QueryConfig<any[]> | number> {

  let queryText: QueryConfig<any[]>

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
      queryText = {
        text: 'insert into active_sessions values (default,$1,current_timestamp,$2) on conflict on constraint unique_uuid do update set last_connect_time = current_timestamp, wallet_address = $3',
        values: [
          `${query.uuid}`,
          `${body.wallet}`,
          `${body.wallet}`,
        ]
      }
    }
    return queryText
  }
}

export default router
