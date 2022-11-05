const Error = require('../classes/Error');
const SqlQuery = require('../classes/SqlQuery');

const { DEFAULT_SALES_QUERY_LIMIT } = require('../consts/apiConsts');
const { sqlStringOk, sqlOkAndCollectionExists, addressIsValid, checkColumnExists } = require('../functions/validationChecks');

const { query } = require('express');
const express = require('express');
var router = express.Router();
const api = require('../api');
const e = require('express');

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

router.get('/', async (req, res) => {

  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  // validate inputs, then run? some inputs may not be needed, how to validate?

  req = await validateInput(req)

  if (typeof req !== "undefined") {

    // console.log(req)

    if (req instanceof Error) {

      res.status(req.httpCode)
      res.send(req.text)

    } else {

      var mintResp = await insertMintRequest(req)

      console.log(" " + mintResp);

      if (mintResp instanceof Error) {

        res.status(mintResp.httpCode)
        res.send(mintResp.text)

      } else {
        res.status("201");

        const respText = {
          response: 'mint request registered successfully, please respond with tx id',
          mintId: mintResp.text
        }

        res.send(respText);
      }
    }

    // console.log("sales" + sales)

  } else {

    var resp = {
      "message": "Call failed!"
    };
    res.status("500");
    res.send(resp);
  }

})

router.get('/addTxId', async (req, res) => {

  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  // validate inputs, then run? some inputs may not be needed, how to validate?

  req = await validateInput(req)

  if (typeof req !== "undefined") {

    // console.log(req)

    if (req instanceof Error) {

      res.status(req.httpCode)
      res.send(req.text)

    } else {

      var mintResp = await insertMintRequest(req)

      console.log(" " + mintResp);

      if (mintResp instanceof Error) {

        res.status(mintResp.httpCode)
        res.send(mintResp.text)

      } else {
        res.status("201");
        res.send("mint request registered successfully");
      }
    }

    // console.log("sales" + sales)

  } else {

    var resp = {
      "message": "Call failed!"
    };
    res.status("500");
    res.send(resp);
  }

})

//collection should exist if supplied, if not set to blank string.
//limit should always be defined, calls should always be limited to some level, set as config var
//searchFor shouldn't contain any banned strings for sql injects
async function validateInput(req) {

  if (req.query !== undefined) {

    if (req.query.collection !== undefined) {

      console.log("collection: " + req.query.collection)

      if (!(await sqlOkAndCollectionExists(req.query.collection))) {

        console.log("collection does not exist!");
        var resp = {
          "message": "collection does not exist.."
        };
        return new Error(resp, "400", 1)
      }
    }

    //check limit is numeric and less than default, or set to default
    if (req.query.limit !== undefined) {

      if (isNaN(req.query.limit) || req.query.limit == "") {

        var resp = {
          "message": "invalid ?limit, not numeric."
        };
        return new Error(resp, "400", 2)

      } else if (req.query.limit > DEFAULT_SALES_QUERY_LIMIT) {
        req.query.limit = DEFAULT_SALES_QUERY_LIMIT
      }

    } else {
      req.query.limit = DEFAULT_SALES_QUERY_LIMIT
    }

    let searchForSqlOK = await sqlStringOk(req.query.searchFor)
    if (!searchForSqlOK) {

      var resp = {
        "message": "invalid ?searchFor."
      };
      return new Error(resp, "400", 3)

    }

    if (req.query.sellerAddr !== undefined) {

      sellerAddrSqlOK = await addressIsValid(req.query.sellerAddr)

      if (!sellerAddrSqlOK) {

        var resp = {
          "message": "invalid ?sellerAddr."
        };
        return new Error(resp, "400", 4)

      }
    }

    if (req.query.verified !== undefined) {

      if (!(["true", "false"].includes(req.query.verified))) {

        var resp = {
          "message": "invalid ?verified."
        };
        return new Error(resp, "400", 5)

      }
    }

  } else {
    // set any defaults that require it 
    req.query.limit = DEFAULT_SALES_QUERY_LIMIT
  }

  return (req)

}

// needs to return the ID of the inserted mintRequest 
async function insertMintRequest(query) {

  return new Promise(resolve => {

    api.siteApiPool.connect(async (err, client, release) => {
      if (err) {
        release()
        throw err
      }

      let stmtTxt = await getInsertMintReqText(query)

      if (!(stmtTxt instanceof Error)) {

        console.log("statement text: " + stmtTxt.text)
        stmtTxt.params.forEach(function (ele) {
          console.log("param:" + ele);
        })

        client
          .query(stmtTxt.text, stmtTxt.params)
          .then(res => {
            release()
            resolve(res)
          })
          .catch(e => {
            release()
            console.error(e.stack)
            var resp = {
              "message": "Call failed, can devs do something?!"
            };
            return new Error(resp, "500", 99)
          })

      } else { //rtn error
        release()
        resolve(stmtTxt)
      }

    })

  });

}


async function getInsertMintReqText(query) {

  // holy JESES SHIT if you don't initiaise these to blank it retains the value of the previous run. node is cobol lol

  let text = "insert into mint_requests(" +
    "id,status,number_to_mint,next_to_mint,total_cost_erg,total_image_size_gb,time_received"
    + ",mint_to_address,transaction_id,entire_mint_json,mint_p2s_address,mint_requests_json) values ("
    + `default, ${query.}`
    + ""

  if (typeof query === "undefined") {

    verifiedSql = getVerifiedSql("false");

    queryText = selectSql + verifiedSql + " order by s1.id desc;";

  } else {

    if (query.status !== undefined) {
      if (["active", "inactive", "complete", "cancelled"].includes(query.status.trim())) {

        statusSql = " status = $::text"
      } else {
        var resp = {
          "message": "invalid ?status, should be active, inactive, complete, cancelled, or not provided."
        };
        return new Error(resp, "400", 6)
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
      //if collection is supplied wdaf if the nft's are verified or not 
      verifiedSql = " c2.verified = $::boolean";
      if (query.verified == undefined) {
        query.verified = "true";
      }
    }

    if (query.sellerAddr !== undefined) {
      sellerAddrSql = " s1.seller_address = $::text";
    }


    // if orderCol not given default to sale id
    if (query.orderCol == undefined) {
      query.orderCol = "s1.id";
    } else {

      //ensure ordering column exists on sales or tokens table
      let tablesToCheck = ["sales", "tokens"]
      let validOrderCol = await checkColumnExists(query.orderCol, tablesToCheck)

      if (validOrderCol) {
        //check for id, needs to be s1.id due to join
        if (query.orderCol == "id") {
          query.orderCol = "s1.id"
        }
      } else {
        var resp = {
          "message": "invalid ?orderCol, does not exist."
        };
        return new Error(resp, "400", 7)
      }
    }

    orderColSql = " order by " + query.orderCol;

    //ensure listing order is OK
    // also no fkkn sql injections
    if (query.order == undefined) {
      orderColSql = orderColSql + " asc";
    } else if (["asc", "a"].includes(query.order)) {
      orderColSql = orderColSql + " asc";
    } else if (["desc", "d"].includes(query.order)) {
      orderColSql = orderColSql + " desc";
    }

    // adds wherevars, if any are not blank, with where at start and 'and' before any additionals. ffs what a pisstake
    whereSqls = [statusSql, collectionSql, searchSql, sellerAddrSql, verifiedSql]
    whereVars = [query.status.trim(), query.collection, query.searchFor, query.sellerAddr, query.verified]
    queryParams = []
    whereSql = ""
    // flag for if first itr
    whereFlag = true
    // positional char for the sql query 
    whereInt = 1;
    loops = 0;
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

    //set select, where, orderCol, and limit - by this point all will be supplied or defaulted
    queryText = selectSql + whereSql + orderColSql + " limit " + query.limit;

    if (query.offset !== undefined) {

      if (!isNaN(query.offset)) {
        queryText = queryText + " offset " + query.offset;

      } else {
        var resp = {
          "message": "invalid ?offset, not numeric."
        };
        return new Error(resp, "400", 8)
      }

    }

    queryText = queryText + " ;";

  }

  return new SqlQuery(queryText, queryParams);

}

module.exports = router;
