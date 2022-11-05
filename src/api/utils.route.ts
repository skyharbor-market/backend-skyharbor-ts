import express, { Request, Response } from "express"
import { siteApiPool } from "../server"
import { sqlOkAndCollectionExists } from "../functions/validationChecks"
import { Error } from "../classes/error"

const router = express.Router();

router.get('/airdropList', async (req: Request, res: Response) => {

  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  // validate inputs, then run? some inputs may not be needed, how to validate?

  req = await validateAirdropInput(req)

  if (typeof req !== "undefined") {

    //   console.log("undefined req! :" + req)

    if (req instanceof Error) {

      res.status(req.httpCode)
      res.send(req.text)

    } else {

      var result = await getAirdropList(req)

      console.log("airdrop list result: " + result);

      if (result instanceof Error) {

        res.status(result.httpCode)
        res.send(result.text)

      } else {
        res.status(200);
        res.send(result);
      }
    }

    // console.log("sales" + sales)

  } else {
    res.status(500);
    res.send({ "message": "Call failed!" });
  }

})

async function validateAirdropInput(req: any) {

  if (req.query !== undefined) {

    if (req.query.collection !== undefined) {

      console.log("collection: " + req.query.collection)

      if (!(await sqlOkAndCollectionExists(req.query.collection))) {
        const resp = {
          "message": "collection provided does not exist.."
        };
        console.log(resp);
        return new Error(resp.message, 400, 1)
      }

    } else {
      return new Error("no 'collection' query param supplied.", 400, 98)

    }

  } else {
    return new Error("no query params supplied.", 400, 99)
  }

  return (req)

}

async function getAirdropList(req: any) {

  return new Promise(resolve => {

    siteApiPool.connect(async (err, client, release) => {
      if (err) throw err;

      let queryText = await getAirdropListQueryText(req);

      if (typeof queryText !== "number") {
        client
          .query(queryText)
          .then(res => {
            release();
            resolve(res.rows);
          })
          .catch(e => {
            release()
            console.error(e.stack)
            return new Error("Call failed in db!", 500, 99)
          })
      } else { //rtn error code
        release()
        resolve(queryText);
      }
    })
  });
}

async function getAirdropListQueryText(req: any) {

  //select seller_address from sales s1 inner join tokens t1 on s1.token_id = t1.token_id where collection = 'anetaangels' and status = 'active';

  let qt = "select seller_address as \"sellerAddress\", count(seller_address) as \"currentlyListedCount\" from sales s1 inner join tokens t1 on s1.token_id = t1.token_id " +

    " where t1.collection = $$" + req.query.collection + "$$ and s1.status = 'active' group by s1.seller_address order by s1.seller_address ;";

  console.log("airdrop query text " + qt);

  return qt;

}

export default router