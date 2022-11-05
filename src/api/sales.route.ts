import express, { Request, Response } from "express"
import { siteApiPool } from "../server"
import { sqlStringOk, sqlOkAndCollectionExists, addressIsValid, checkColumnExists } from "../functions/validationChecks"
import { QueryResult } from "pg";
import { Error } from "../classes/error"
import { SqlQuery } from "../classes/sqlquery"
import { DEFAULT_SALES_QUERY_LIMIT } from "../consts/apiConsts"

const router = express.Router();

const selectSql = "select s1.id, t1.nft_name, s1.token_id, t1.nft_desc, t1.total_existing, t1.nft_type, " +
  "t1.ipfs_art_url, t1.ipfs_art_hash, t1.ipfs_audio_url, t1.nft_hash, " +
  // "m1.address as mint_address, "+
  "t1.royalty_int, t1.royalty_address, s1.status, s1.nerg_sale_value, s1.list_time, s1.seller_address, " +
  "s1.seller_ergotree, s1.buyer_address, s1.buyer_ergotree, s1.completion_time, " +
  "t1.collection as collection_sys_name, c2.name as collection_name, c2.verified as verified_collection, " +
  " s1.currency, c1.decimals, s1.box_id, s1.creation_tx, s1.creation_height, s1.spent_tx, s1.token_amount, " +
  //sales address isn't even needed LMAO it's in the box json
  "s1.nerg_service_value, s1.nerg_royalty_value, s1.box_json, s2.address as sales_address " +
  "from sales s1 inner join tokens t1 on s1.token_id = t1.token_id " +
  "inner join currencies c1 on s1.currency = c1.name " +
  "inner join collections c2 on c2.sys_name = t1.collection " +
  // "inner join mint_addresses m1 on m1.collection = c2.sys_name "+
  "inner join sales_addresses s2 on s1.sales_address_id = s2.id ";

//- call for all sales, have ?status param(active,inactive,complete,cancelled) ?collection (collection name as text)
router.get('/schema', async (req: Request, res: Response) => {

  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  //if (typeof req.headers.uniqueid !== "undefined") { 

  const sales = await getSales();

  if (!(sales instanceof Error)) {

    res.send(sales.fields);

  } else {
    res.status(500);
    res.send({ "message": "Call failed!" });
  }
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

  // validate inputs, then run? some inputs may not be needed, how to validate?

  req = await validateInput(req)

  if (typeof req !== "undefined") {

    // console.log(req)

    if (req instanceof Error) {

      res.status(req.httpCode)
      res.send(req.text)

    } else {

      var sales = await getSales(req.query)

      console.log(" " + sales);

      if (sales instanceof Error) {

        res.status(sales.httpCode)
        res.send(sales.text)

      } else {
        res.status(200);
        res.send(sales.rows);
      }
    }

    // console.log("sales" + sales)

  } else {
    res.status(500);
    res.send({ "message": "Call failed!" });
  }

})

//collection should exist if supplied, if not set to blank string.
//limit should always be defined, calls should always be limited to some level, set as config var
//searchFor shouldn't contain any banned strings for sql injects
async function validateInput(req: any) {

  if (req.query !== undefined) {

    if (req.query.collection !== undefined) {

      console.log("collection: " + req.query.collection)

      if (!(await sqlOkAndCollectionExists(req.query.collection))) {

        console.log("collection does not exist!");
        return new Error("collection does not exist..", 400, 1)
      }
    }

    //check limit is numeric and less than default, or set to default
    if (req.query.limit !== undefined) {

      if (isNaN(req.query.limit) || req.query.limit == "") {
        return new Error("invalid ?limit, not numeric.", 400, 2)
      } else if (req.query.limit > DEFAULT_SALES_QUERY_LIMIT) {
        req.query.limit = DEFAULT_SALES_QUERY_LIMIT
      }

    } else {
      req.query.limit = DEFAULT_SALES_QUERY_LIMIT
    }

    let searchForSqlOK = await sqlStringOk(req.query.searchFor)
    if (!searchForSqlOK) {
      return new Error("invalid ?searchFor.", 400, 3)
    }

    if (req.query.sellerAddr !== undefined) {

      const sellerAddrSqlOK = await addressIsValid(req.query.sellerAddr)

      if (!sellerAddrSqlOK) {
        return new Error("invalid ?sellerAddr.", 400, 4)
      }
    }

    if (req.query.verified !== undefined) {

      if (!(["true", "false"].includes(req.query.verified))) {
        return new Error("invalid ?verified.", 400, 5)
      }
    }

    if (req.query.saleId !== undefined) {
      if (isNaN(req.query.saleId)) {
        return new Error("invalid ?saleId, not numeric.", 400, 6)
      }
    }

  } else {
    // set any defaults that require it 
    req.query.limit = DEFAULT_SALES_QUERY_LIMIT
  }

  return (req)

}

//query = ?collection ?status ?orderCol ?order ?limit ?offset ?searchFor 
async function getSales(query?: any): Promise<QueryResult<any | Error> | Error> {

  return new Promise(resolve => {

    siteApiPool.connect(async (err, client, release) => {
      if (err) {
        release()
        throw err
      }

      let sqlQuery = await getQueryText(query)

      if (!(sqlQuery instanceof Error)) {

        console.log("query text: " + sqlQuery.text)
        sqlQuery.params.forEach(function (ele) {
          console.log("param:" + ele);
        })

        client
          .query(sqlQuery.text, sqlQuery.params)
          .then(res => {
            release()
            resolve(res)
          })
          .catch(e => {
            release()
            console.error(e.stack)
            return new Error("Call failed, can devs do something?!", 500, 99)
          })

      } else { //rtn error
        release()
        resolve(sqlQuery)
      }

    })

  });

}


async function getQueryText(query: any | undefined) {

  // holy JESES SHIT if you don't initiaise these to blank it retains the value of the previous run. node is cobol lol
  let saleIdSql = "";
  let statusSql = "";
  let orderColSql = "";
  let collectionSql = "";
  let searchSql = "";
  let sellerAddrSql = "";
  let verifiedSql = "";
  let offsetIdOperator = "";
  let queryParams: any[] = []
  let queryText = ""

  if (typeof query === "undefined") {

    // TODO: missing getVerifiedSql function
    //verifiedSql = getVerifiedSql("false");
    //queryText = selectSql + verifiedSql + " order by s1.id desc;";

  } else {

    if (query.saleId !== undefined) {
      saleIdSql = " s1.id = $::integer"
    }

    if (query.status !== undefined) {
      if (["active", "inactive", "complete", "cancelled"].includes(query.status.trim())) {

        statusSql = " status = $::text"
      } else {
        var resp = {
          "message": "invalid ?status, should be active, inactive, complete, cancelled, or not provided."
        };
        return new Error(resp.message, 400, 6)
      }
    } else {
      //needed so .trim below works, why are you trimming only this field anyway wtf
      query.status = "";
    }

    if (query.searchFor !== undefined) {
      if (query.collection !== undefined) {
        searchSql = " ( lower(t1.nft_name) like concat('%%', lower($::text) ,'%%') or  lower(t1.nft_desc) like concat('%%', lower($::text) ,'%%') )"
      } else {
        searchSql = " lower(t1.nft_name) like concat('%%', lower($::text) ,'%%')"
      }
    }

    if (query.collection !== undefined) {
      collectionSql = " t1.collection = $::text"
    } else {
      //if collection is supplied wdgaf if the nft's are verified or not 
      verifiedSql = " c2.verified = $::boolean";
      if (query.verified === undefined) {
        query.verified = "true";
      }
    }

    if (query.sellerAddr !== undefined) {
      sellerAddrSql = " s1.seller_address = $::text";
    }


    // if orderCol not given default to sale id
    if (query.orderCol === undefined) {
      query.orderCol = "s1.id";
    } else {

      //ensure ordering column exists on sales or tokens table
      let tablesToCheck = ["sales", "tokens"]
      let validOrderCol = await checkColumnExists(query.orderCol, tablesToCheck)

      if (validOrderCol) {
        //check for id, needs to be s1.id due to join including multiple tables with id col
        if (query.orderCol == "id") {
          query.orderCol = "s1.id"
        }
      } else {
        var resp = {
          "message": "invalid ?orderCol, does not exist."
        };
        return new Error(resp.message, 400, 7)
      }
    }

    orderColSql = " order by " + query.orderCol;

    //ensure listing order is OK
    // also no fkkn sql injections
    if (query.order === undefined) {
      orderColSql = orderColSql + " asc";
      offsetIdOperator = ">"
    } else if (["asc", "a"].includes(query.order)) {
      orderColSql = orderColSql + " asc";
      offsetIdOperator = ">"
    } else if (["desc", "d"].includes(query.order)) {
      orderColSql = orderColSql + " desc";
      offsetIdOperator = "<"
    }

    // adds wherevars, if any are not blank, with where at start and 'and' before any additionals. ffs what a pisstake
    let whereSqls = [saleIdSql, statusSql, collectionSql, searchSql, sellerAddrSql, verifiedSql]
    let whereVars = [query.saleId, query.status.trim(), query.collection, query.searchFor, query.sellerAddr, query.verified]
    let whereSql = ""
    // flag for if first itr
    let whereFlag = true
    // positional char for the sql query 
    let whereInt = 1;
    let loops = 0;
    whereSqls.forEach(function (ele) {

      if (ele !== "") {
        if (whereFlag) {
          whereSql = "where "
          whereFlag = false;
        } else {
          whereSql = whereSql + " and "
        }
        // each ele will be a string with dollar symbs in. you need to replace the symbs with symbs with numbers,
        // and this should work for any string the user needs to supply. 
        whereSql = whereSql + ele.replace(/\$/g, "$" + whereInt);
        queryParams.push(whereVars[loops])

        whereInt++;
      }
      loops++
    })

    if (query.offsetId !== undefined && query.offset !== undefined) {
      var resp = {
        "message": "invalid combination of ?offset and ?offsetID, cannot supply both."
      };
      return new Error(resp.message, 400, 8)
    } else {
      if (query.offsetId !== undefined) { //offset by offsetId, which ensures that duplicates aren't returned 
        if (!isNaN(query.offsetId)) {
          //set select, where, orderCol, limit, and offset - by this point all will be supplied or defaulted
          queryText = selectSql + whereSql + " and " + query.orderCol + " " + offsetIdOperator + " " + query.offsetId + orderColSql + " limit " + query.limit;

        } else {
          if (await sqlStringOk(query.offsetId)) {
            queryText = selectSql + whereSql + " and " + query.orderCol + " " + offsetIdOperator + " $$" + query.offsetId + "$$ " + orderColSql + " limit " + query.limit;

          } else {
            var resp = {
              "message": "invalid ?offsetId."
            };
            return new Error(resp.message, 400, 3)
          }
        }
      } else { //offset by offset statement (this has potential to bring back already-viewed NFTs)
        if (query.offset !== undefined) {

          if (!isNaN(query.offset)) {

            //set select, where, orderCol, limit, and offset - by this point all will be supplied or defaulted
            queryText = selectSql + whereSql + orderColSql + " limit " + query.limit + " offset " + query.offset;

          } else {
            var resp = {
              "message": "invalid ?offset, not numeric."
            };
            return new Error(resp.message, 400, 8)
          }
        } else { //no offsets 
          //set select, where, orderCol, and limit - by this point all will be supplied or defaulted
          queryText = selectSql + whereSql + orderColSql + " limit " + query.limit;

        }
      }
    }

    queryText = queryText + " ;";

  }

  return new SqlQuery(queryText, queryParams);

}

export default router
