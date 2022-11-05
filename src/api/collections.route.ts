import express, { Request, Response } from "express"
import { siteApiPool } from "../server"
import { sqlOkAndCollectionExists } from "../functions/validationChecks"
import { QueryResult } from "pg";
import { Error } from "../classes/error"

const router = express.Router();

router.get('/schema', async (req: Request, res: Response) => {

  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  // TODO: missing assignment of collections
  /*if (typeof collections !== "undefined") {
 
    res.send(collections.fields);
 
  } else {
 
    var resp = {
      "message": "Call failed!"
    };
    res.status(500);
    res.send(resp);
  }*/
  /*
  } else {
      var resp = {
          "message": "Request needs header uniqueid to select and lock token!"
      };
      res.status("400");
      res.send(resp);
  }*/

})

router.get('/', async (req: Request, res: Response) => {

  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  const colls = await getCollections(req.query);

  if (typeof colls !== "undefined") {

    // console.log("collections" + collections)
    if (colls instanceof Error) {

      res.status(colls.httpCode)
      res.send(colls.text)

    } else {
      res.status(200);
      res.send(colls.rows);
    }

  } else {

    var resp = {
      "message": "Call failed!"
    };
    res.status(500);
    res.send(resp);
  }


})

async function getCollections(query: any): Promise<QueryResult<any | Error> | Error> {

  return new Promise(resolve => {

    siteApiPool.connect(async (err, client, release) => {
      if (err) throw err;

      const sqlQuery = await getQueryText(query)

      console.log(sqlQuery.toString)

      if (!(sqlQuery instanceof Error)) {
        client
          .query(sqlQuery)
          .then((res: QueryResult<any>) => {
            release()
            resolve(res)

          })
          .catch((e: any) => {
            release()
            console.error(e.stack)
            var resp = {
              "message": "Call failed, can devs do something?!"
            };
            return new Error(resp.message, 500, 99)
          })
      } else { //rtn error code
        release()
        resolve(sqlQuery)
      }
    })
  });
}

async function getQueryText(query: any): Promise<string | Error> {

  if (query.collection == undefined && query.verified == undefined) {

    return "select * from collections where verified = true order by name asc;"

  } else {

    let collectionSql = ""
    let verifiedSql = " c1.verified = true"

    //ensure collection exists and disregard verif if so 
    if (query.collection !== undefined) {

      if (await sqlOkAndCollectionExists(query.collection)) {

        verifiedSql = " (c1.verified = false or c1.verified = true)  and "
        collectionSql = " c1.sys_name = $$" + query.collection + "$$"

      } else {
        var resp = {
          "message": "invalid ?collection, does not exist."
        };
        return new Error(resp.message, 400, 1)
      }
    } else {

      if (query.verified !== undefined) {
        if (query.verified == "false") {
          verifiedSql = " c1.verified = false"
        }
      }
    }

    return "select c1.*, array_agg(m1.address) as mint_addresses from collections " +
      "c1 inner join mint_addresses m1 on c1.sys_name = m1.collection where " + verifiedSql + collectionSql +
      " group by c1.id order by c1.name ; "

  }

}

export default router
