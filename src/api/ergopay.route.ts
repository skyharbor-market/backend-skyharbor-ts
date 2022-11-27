import express, { Request, Response } from "express"
import { ergoPayPool } from "../server"
import { PoolClient, QueryResult } from "pg"
import { ErgoPayResponse, Severity } from "../classes/ergopay"
import cors from "cors"

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
//router.options('*', cors(options));

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

router.route("/getTx/:txId/:addr").get(cors(options), async (req: Request, res: Response): Promise<void> => {
  const txId = req.params.txId || ""
  const addr = req.params.addr || ""
  let response = new ErgoPayResponse()
  let dbResp: QueryResult<any> | number

  const dbQuery = `select tx_data from pay_requests where uuid = '${txId}';`

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

  console.log(dbResp)
  response.reducedTx = dbResp.rows[0]
  response.address = addr
  response.message = `Your NFT purchase is ready to be signed`
  response.messageSeverity = Severity.INFORMATION

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

async function saveTx(body: any, query: any): Promise<QueryResult<any> | number> {

  return new Promise(resolve => {

    ergoPayPool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err;

      let queryText = await getTxDataQueryText(body, query);

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


async function getTxDataQueryText(body: any, query: any): Promise<string | number> {

  let queryText = ""

  if (typeof query === "undefined") {
    return 400001
  } else {
    if (query.uuid === undefined) {
      return 400002
    } else if (body === undefined) {
      return 400003
    } else if (body.txData === undefined) {
      return 400003
    } else {
      queryText = `insert into pay_requests values (default,$$${body.txId}$$,$$${body.txData}$$,current_timestamp) ;`

    }
    return queryText
  }
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