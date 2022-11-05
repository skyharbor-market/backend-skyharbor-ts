import express, { Request, Response } from "express"
import { siteApiPool } from "../server"
import { sqlOkAndCollectionExists } from "../functions/validationChecks"
import { PoolClient, QueryResult } from "pg";
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

// I think currency is causing this to fuck up and go to 0...
router.get('/floorPrices', async (req: Request, res: Response) => {
  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  var rs = await validateFloorPriceReq(req);

  if (rs == 400001) {
    res.status(400);
    res.send({ "message": "please provide query params" });
    return;
  } else if (rs == 400002) {
    res.status(400);
    res.send({ "message": "please provide ?collection query param" });
    return;
  } else if (rs == 400003) {
    res.status(400);
    res.send({ "message": "collection does not exist.." });
    return;
  } else if (rs == 400004) {
    res.status(400);
    res.send({ "message": "days should be numeric.." });
    return;
  } else if (rs == 400005) {
    res.status(400);
    res.send({ "message": "please provide ?days query param" });
    return;
  }

  // for each count, call getFloorPrices with a daysPrev of 0 + i
  // create array for the floor prices, add in each call to db? 
  let respArray = new Array();
  let colls: string | Error = "";
  // so set lastVal to 0, work backwards from like 30 days out, if price comes back null set to lastVal,
  // and then if subsequent call for 29 days returns a value it should use returned value and update lastVal,
  //  if still null set to lastVal 
  let lastVal = 0;
  let i: number = Number(req.query.days);
  while (i > 0) {

    // call to get the array item for today - i
    colls = await getFloorPriceOnDate(req.query.collection, i);

    if (Number(colls) == 0 && i == Number(req.query.days)) {
      colls = await getFloorPricePrev(req.query.collection, i)
    }

    if (colls instanceof Error) {
      res.status(colls.httpCode)
      res.send(colls.text)
    }

    // TODO: not sure where/how floor_value is being set here
    //if (colls.floor_value == null || colls.floor_value == 0) {
    //  colls.floor_value = lastVal
    //} else {
    //  lastVal = colls.floor_value
    //}

    console.log(colls);

    i--
    //put into response array 
    respArray[i] = colls;
  }

  console.log(respArray);

  // if response array is good? 
  if (typeof respArray !== "undefined") {

    // console.log("collections" + collections)

    if (Number(colls) == 500000) {
      res.status(500);
      res.send({ "message": "Call failed, can devs do something?!" });
      return;
    } else {
      res.status(200);
      res.send(respArray);
      return;
    }

  } else {
    res.status(500);
    res.send({ "message": "Call failed!" });
    return;
  }

})

//query params exist
//collection exists on db
//days is numeric
async function validateFloorPriceReq(req: any) {

  if (req.query !== undefined) {

    //ensure collection exists
    if (req.query.collection !== undefined) {
      if (await sqlOkAndCollectionExists(req.query.collection)) {

        const collectionSql = req.query.collection;

      } else {
        return 400003;
      }
    } else {
      return 400002;
    }

    //ensure days is numeric
    if (req.query.days !== undefined) {

      if (!isNaN(req.query.days)) {
        return 0;
      } else {
        return 400004;
      }
    } else {
      return 400005;
    }
  } else {
    return 400001;
  }

}

async function getFloorPriceOnDate(coll: any, daysPrev: any): Promise<string> {

  return new Promise(resolve => {

    siteApiPool.connect(async (err, client, release) => {
      if (err) throw err;

      let queryText = await getFloorPriceOnDateQueryText(coll, daysPrev);

      if (typeof queryText !== "number") {
        client
          .query(queryText)
          .then(res => {
            release();
            resolve(res.rows[0]);
          })
          .catch(e => {
            release()
            console.error(e.stack)
            return new Error("Call failed in db.", 500, 99)
          })
      } else { //rtn error code
        release()
        resolve(queryText);
      }
    })
  });
}


async function getFloorPricePrev(coll: any, daysPrev: any): Promise<string | Error> {

  return new Promise(resolve => {

    siteApiPool.connect(async (err, client, release) => {
      if (err) throw err;

      let queryText = await getFloorPricePrevQueryText(coll, daysPrev);

      if (typeof queryText !== "number") {
        client
          .query(queryText)
          .then(res => {
            release();
            resolve(res.rows[0]);
          })
          .catch(e => {
            release()
            console.error(e.stack)
            return new Error("Call failed in db.", 500, 99)
          })
      } else { //rtn error code
        release()
        resolve(queryText);
      }
    })
  });
}

//you could prog this to do any time interval quite easily. pass in interval query as 'hours, days, weeks'
//get lowest price for any listing which completed (but not cancelled) on that date
// where status = complete and completion_time > start_time and completion_time < end_time 
// or was listed for at least 6h on that date
// OR (list time < end time and ( (completion_time > list time + interval '6' hours) OR (completion_time is null) );
async function getFloorPriceOnDateQueryText(coll: any, daysPrev: any) {

  daysPrev = parseInt(daysPrev, 10);

  console.log("" + daysPrev);

  let qt = "select current_timestamp - interval '" + (daysPrev) + "' day as ts, min(s1.nerg_sale_value) as floor_value " +
    "from sales s1 inner join tokens t1 on s1.token_id = t1.token_id where t1.collection = '" + coll + "' and " +
    //completed on that day as complete
    "((status = 'complete' and completion_time < current_timestamp - interval '" + (daysPrev - 1) + "' day " +
    "and completion_time > current_timestamp - interval '" + daysPrev + "' day) " +
    // or listed on or before that date and incomplete
    "or (list_time < current_timestamp - interval '" + daysPrev + "' day and completion_time is null) " +
    //r completed on that day as cancelled but listed for at least 6 hours 
    "or (status = 'cancelled' and completion_time < current_timestamp - interval '" + (daysPrev - 1) + "' day and " +
    "completion_time > current_timestamp - interval '" + daysPrev + "' day and completion_time > list_time + interval '6' hour )) ;";

  console.log(qt);

  return qt;

}

async function getFloorPricePrevQueryText(coll: any, daysPrev: any) {

  daysPrev = parseInt(daysPrev, 10);

  console.log("" + daysPrev);

  // looking for the lowest listing in the past month... this sucks, would be much easier with a database recording floor prices each day or something

  let qt = "select current_timestamp - interval '" + (daysPrev) + "' day as ts, min(s1.nerg_sale_value) as floor_value " +
    "from sales s1 inner join tokens t1 on s1.token_id = t1.token_id where t1.collection = '" + coll + "' and " +
    //completed on that mon as complete
    "((status = 'complete' and completion_time < current_timestamp " +
    "and completion_time > current_timestamp - interval '30' day) " +
    // or listed on or before that date and incomplete
    "or (list_time < current_timestamp - interval '30' day and completion_time is null) " +
    // or completed on that day as cancelled but listed for at least 6 hours 
    "or (status = 'cancelled' and completion_time < current_timestamp - interval '" + (daysPrev - 1) + "' day and " +
    "completion_time > current_timestamp - interval '" + daysPrev + "' day and completion_time > list_time + interval '6' hour )) ;";

  console.log(qt);

  return qt;

}

router.get('/topVolumes', async (req: Request, res: Response) => {

  // res.set('Access-Control-Allow-Origin', 'https://skyharbor.io');

  var colls = await getTopVolumes(req.query);

  if (typeof colls !== "undefined") {

    // console.log("collections" + collections)

    if (typeof colls === "number") {
      if (colls == 400001) {
        res.status(400);
        res.send({ "message": "please provide ?limit query param" });
      } else if (colls == 400002) {
        res.status(400);
        res.send({ "message": "please provide query params" });
      } else if (colls == 400003) {
        res.status(400);
        res.send({ "message": "limit should be numeric.." });
      } else if (colls == 500000) {
        res.status(500);
        res.send({ "message": "Call failed, can devs do something?!" });
      }
    } else {
      res.status(200);
      res.send(colls.rows);
    }
  } else {
    res.status(500);
    res.send({ "message": "Call failed!" });
  }

})

async function getTopVolumes(query: any): Promise<QueryResult<any> | number> {

  return new Promise(resolve => {

    siteApiPool.connect(async (err: globalThis.Error, client: PoolClient, release: any) => {
      if (err) throw err;

      const queryText = await getTopVolumeQueryText(query);

      console.log(queryText.toString)

      if (typeof queryText !== "number") {
        client
          .query(queryText)
          .then(res => {
            release();
            resolve(res);
          })
          .catch(e => {
            release()
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


async function getTopVolumeQueryText(query: any) {

  if (query !== undefined) {

    if (query.limit !== undefined) {

      if (!isNaN(query.limit)) {

        return "select t1.collection, SUM(s1.nerg_sale_value) from sales " +
          "s1 inner join tokens t1 on s1.token_id = t1.token_id inner join collections c1 on c1.sys_name = t1.collection where status = 'complete' and " +
          "completion_time > ( current_timestamp - interval '7' day ) and s1.currency = 'erg' and c1.verified = true group by t1.collection " +
          "order by SUM(s1.nerg_sale_value) desc limit " + query.limit + ";"

      } else {
        return 400003;
      }
    } else {
      return 400001;
    }
  } else {
    return 400002;
  }
}


export default router