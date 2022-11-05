
import { siteApiPool, consts } from "../server"
import { bannedSqlStrings } from "../consts/apiConsts"
import { PoolClient, QueryResult } from "pg";

const wasm = require('ergo-lib-wasm-nodejs');

// import { Error } from '../classes/Error'

export async function sqlStringOk(str: any) {

  let ok = true

  if (str !== undefined) {

    bannedSqlStrings.every(function (ele: any) {
      if (str.includes(ele)) {
        ok = false;
        return false // break from every
      } else {
        return true // continue every
      }
    })

  } else {
    console.log("undefined string passed to sqlStringOk")
  }

  return ok
}

export async function sqlOkAndCollectionExists(coll: any) {

  let exists = false;

  if (coll !== undefined) {

    if (await sqlStringOk(coll)) {

      return checkDbForCollection(coll)

    }
  }

  return exists;
}

export async function checkDbForCollection(coll: any): Promise<boolean> {
  return new Promise(resolve => {

    siteApiPool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err;
      const queryText = "select 'a' from collections where sys_name = $$" + coll + "$$ ;"
      client
        .query(queryText)
        .then((res: QueryResult<any>) => {
          release()
          if (res.rowCount > 0) {
            console.log("     ****** collection exists! ******     ")
            resolve(true)
          } else {
            console.log("     ****** collection DOES NOT exist! ******     ")
            resolve(false)
          }
        })
        .catch((e: any) => {
          release()
          console.error(e.stack)
          resolve(false)
        })
    })
  });
}


export async function addressIsValid(addr: any) {

  let valid = false;

  if (addr !== undefined) {

    if (addr.length == 51) {

      return wasm.Address.from_mainnet_str(addr);
    }
  }

  return valid;
}


export async function checkColumnExists(col: any, tablesToCheck: any) {
  let validCol = false;

  // SALES
  if (tablesToCheck.includes("sales")) {

    (await consts).salesCols.every(function (ele: any) {
      if (ele.name == col) {
        validCol = true;
        return false
      } else {
        return true
      }
    })
  }

  // tokens
  if ((tablesToCheck.includes("tokens")) && (validCol == false)) {

    (await consts).tokensCols.every(function (ele: any) {
      if (ele.name == col) {
        validCol = true
        return false
      } else {
        return true
      }
    })
  }

  return validCol;
}