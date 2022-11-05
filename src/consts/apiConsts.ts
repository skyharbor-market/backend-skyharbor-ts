export const bannedSqlStrings = [";", "drop", "DROP", "select", "SELECT", "$$", "--", "\\"]

export const DEFAULT_SALES_QUERY_LIMIT = 1000

import { FieldDef, PoolClient, QueryResult } from "pg";
import { siteApiPool } from "../server"

export async function initConsts(): Promise<{
  collCols: FieldDef[];
  salesCols: FieldDef[];
  tokensCols: FieldDef[];
}> {
  return new Promise(resolve => {
    var memory = (async () => {
      // console.log(collections)

      var collections = await getCollections();
      // no longer needed with unverified collections 
      // var colls = collections.rows;
      var collCols = collections.fields;
      var salesCols = await getSalesCols();
      var tokensCols = await getTokensCols();
      // console.log(salesCols)

      var memory = {
        // "collections": colls, 
        "collCols": collCols,
        "salesCols": salesCols,
        "tokensCols": tokensCols
      };

      // console.log(memory);
      return (memory);
    })();
    resolve(memory);
  });
}


async function getCollections(): Promise<QueryResult<any>> {
  return new Promise(resolve => {

    siteApiPool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err;

      const queryText = "SELECT * from collections order by id desc;";
      client
        .query(queryText)
        .then((res: QueryResult<any>) => {
          release();
          console.log("query text: " + queryText);
          resolve(res);
        })
        .catch((e: any) => {
          console.error(e.stack)
        })

    })

    //need to grab the column names from sales too. can't do a select on sales, that would be nuts. can I just select it's schema? 
    // select * from sales where false; will do what you need
  });

}


async function getSalesCols(): Promise<FieldDef[]> {
  return new Promise(resolve => {

    siteApiPool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err;

      const queryText = "select * from sales where false;";
      client
        .query(queryText)
        .then((res: QueryResult<any>) => {
          release();
          resolve(res.fields);
        })
        .catch((e: any) => { console.error(e.stack) })
    })

  });
}


async function getTokensCols(): Promise<FieldDef[]> {
  return new Promise(resolve => {

    siteApiPool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err;

      const queryText = "select * from tokens where false;";
      client
        .query(queryText)
        .then((res: QueryResult<any>) => {
          release();
          resolve(res.fields);
        })
        .catch((e: any) => { console.error(e.stack) })
    })

  });
}