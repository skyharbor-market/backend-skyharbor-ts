import { Pool, PoolClient, QueryResult, QueryConfig } from 'pg'
import { siteApiPool } from '../server'
import { Sale } from '../classes/sale'
import { Token } from '../classes/token'
import { SalesAddress } from '../classes/salesAddress'
import logger from '../logger'


async function checkSaleExists(s: Sale): Promise<boolean> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select id from public.sales where box_id = $1',
    values: [`${s.boxId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return false
  }

  if (dbResp.rowCount > 0) {
    return true
  }

  return false
}

async function getNumOfCollsUnderMintAddr(mintAddress: string): Promise<number | undefined> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select distinct count(collection) from public.mint_addresses where address = $1',
    values: [`${mintAddress}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return 0
  }

  return dbResp.rowCount
}

// TODO: unverifiedCollImageLink comes from a config
async function createUnverifiedCollection(mintAddress: string, unverifiedCollImageLink: string = ''): Promise<string | undefined> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: `insert into collections
            (id, name, first_mint_date, addition_time, current_mint_number, description, sys_name, card_image, banner_image, verified)
           values
            (default, $1, null, current_timestamp, null, $$Unverified collection - Please be aware that SkyHarbor may delist this collection if they do not adhere to rules on allowed artworks.$$,
            $2, $3, null, false)`,
    values: [`${mintAddress}`, `${mintAddress}`, `${unverifiedCollImageLink}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  if (dbResp.rowCount > 0) {
    const dbQuery: QueryConfig<any[]> = {
      text: `insert into mint_addresses values(default,$1,$2)`,
      values: [`${mintAddress}`, `${mintAddress}`]
    }
    try {
      dbResp = await executeDBQuery(dbQuery)
    } catch (e) {
      logger.error({
        message: "DB error in sales scanner",
        error: e.message,
        query_text: dbQuery.text,
        query_values: dbQuery.values
      })
      return undefined
    }

    if (dbResp.rowCount > 0) {
      return mintAddress
    }
  }

  return undefined
}

export async function getAllActiveSales(): Promise<QueryResult<any> | undefined> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select box_id from public.sales where status = $1',
    values: ['active']
  }

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  return dbResp
}

export async function getActiveSalesBySaId(saleAddrId: number): Promise<QueryResult<any> | undefined> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select box_id from public.sales where status = $1 and sales_address_id = $2',
    values: ['active', `${saleAddrId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  return dbResp
}

export async function getAllInactiveSales(): Promise<QueryResult<any> | undefined> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select box_id from public.sales where status = $1',
    values: ['inactive']
  }

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  return dbResp
}

export async function checkTokenExistsOnDb(tokenId: string): Promise<boolean> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select id from public.tokens where token_id = $1',
    values: [`${tokenId}`]
  }

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return false
  }

  if (dbResp.rowCount > 0) {
    return true
  }

  return false
}

export async function executeDBQuery(query: QueryConfig<any[]>, pool: Pool = siteApiPool, asPg: boolean = false): Promise<QueryResult<any>> {

  // use prod unless this is a test environment
  // if (!asPg) {
  //   //console.log("query", query)
  //   switch (process.env.NODE_ENV) {
  //     case 'test':
  //       pool = testApiKeysPool
  //       break
  //   }
  // }

  return new Promise((resolve, reject) => {

    pool.connect(async (err: Error, client: PoolClient, release: any) => {
      if (err) throw err

      client
        .query(query)
        .then(res => {
          release()
          resolve(res)
        })
        .catch(e => {
          release()
          reject(e)
        })
    })
  })
}

export async function getActiveSalesAddresses(): Promise<QueryResult<any> | undefined> {
  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select * from public.sales_addresses where active_until > current_timestamp OR active_until is null',
    values: []
  }

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  return dbResp
}

// TODO: rewrite this so it does one SQL call just to get collections for mint addr and uses arraylist instead of needing to form a sized array
export async function getOrCreateCollectionsForMintAddress(token: Token): Promise<string[] | undefined> {
  const collectionsExistingForAddress = await getNumOfCollsUnderMintAddr(token.mintAddress)

  if (typeof collectionsExistingForAddress === 'undefined') {
    return undefined
  } else if (collectionsExistingForAddress > 1) {
    const unverifiedColl: string[] = []
    const res = await createUnverifiedCollection(token.mintAddress)
    if (typeof res !== 'undefined') {
      unverifiedColl.push(res)
    }
    return unverifiedColl
  }

  let dbResp: QueryResult<any> | undefined
  const dbQuery: QueryConfig<any[]> = {
    text: 'select collection from public.mint_addresses WHERE address = $1',
    values: [`${token.mintAddress}`]
  }
  const possibleCollections: string[] = []

  try {
    dbResp = await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return undefined
  }

  dbResp.rows.forEach((row) => {
    possibleCollections.push(row.collection)
  })

  return possibleCollections
}

export async function addOrReactivateSale(s: Sale): Promise<void> {
  logger.info(`Adding or updating sale with box id: ${s.boxId}`)

  const dbQuery: QueryConfig<any[]> = { text: "", values: [] }

  if (await checkSaleExists(s)) {
    dbQuery.text = `update public.sales set status = $1, completion_time = NULL, box_json = $2 where box_id = $3`
    dbQuery.values = ['active', `${s.boxJsonStr}`, `${s.boxId}`]
  } else {
    dbQuery.text = `insert into public.sales values(default,$1,$2,$3,current_timestamp,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`
    dbQuery.values = [
      `${s.status}`,
      `${s.tokenId}`,
      `${s.nergSaleValue}`,
      `${s.sellerAddr}`,
      `${s.sellerErgoTree}`,
      `${s.buyerAddr}`,
      `${s.buyerErgoTree}`,
      `${s.boxId}`,
      `${s.tokenAmount}`,
      `${typeof s.salesAddress !== 'undefined' ? s.salesAddress.currency : 'erg'}`,
      `${s.creationTx}`,
      `${s.creationHeight}`,
      `${s.nergServiceValue}`,
      `${s.nergRoyaltyValue}`,
      `${s.spentTx}`,
      null,
      `${s.boxJsonStr}`,
      `${typeof s.salesAddress !== 'undefined' ? s.salesAddress.id : null}`
    ]
  }

  try {
    await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
  }
}

export async function addTokenToDb(token: Token): Promise<Error | undefined> {
  const dbQuery: QueryConfig<any[]> = {
    text: `insert into tokens values(default,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    values: [
      `${token.name}`,
      `${token.collectionSysName}`,
      `${token.tokenId}`,
      `${token.tokenTypeStr}`,
      `${token.description}`,
      `${token.artUrl}`,
      `${token.ipfsArtHash}`,
      `${token.audio_url}`,
      `${token.emmissionCount}`,
      `${token.royaltyValueStr}`,
      `${token.royaltyAddress}`,
      `${token.royaltyErgoTree}`,
      `${token.artHash}`,
      `${token.mintAddress}`
    ]
  }

  try {
    await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
    return new Error(e.message)
  }

  return undefined
}

export async function writeFinishedSaleToDb(s: Sale): Promise<void> {
  logger.info(`marking sale as ${s.status}: ${s.boxId}`)

  const dbQuery: QueryConfig<any[]> = {
    text: "update public.sales set status = $1, buyer_address = $2, buyer_ergotree = $3, spent_tx = $4, box_json = $5 where box_id = $6",
    values: [`${s.status}`, `${s.buyerAddr}`, `${s.buyerErgoTree}`, `${s.spentTx}`, `${s.boxJsonStr}`, `${s.boxId}`]
  }

  try {
    await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
  }
}

export async function batchMarkInactiveSalesBySaId(inactiveSales: string[], saId: number): Promise<void> {
  let dbQuery: QueryConfig<any[]>

  let text: string = 'update public.sales set status = $1, completion_time = current_timestamp where box_id in('
  let values: string[] = ['inactive']
  let count: number = 2
  inactiveSales.forEach(inactiveSale => {
    text = text + `$${count++},`
    values.push(inactiveSale)
  })

  text = text.slice(0, -1) + `) and sales_address_id = $${count}` // remove trailing comma
  values.push(saId.toString())

  dbQuery = {
    text: text,
    values: values
  }

  try {
    await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
  }
}

export async function deactivateSalesNotOnActiveAddresses(salesAddresses: SalesAddress[]): Promise<void> {
  logger.info("marking active sales on inactive addresses as 'salesAddressInactive'")

  let dbQuery: QueryConfig<any[]>

  let text: string = 'update public.sales set status = $1 where status = $2 and sales_address_id NOT in('
  let values: string[] = ['salesAddressInactive', 'active']
  let count: number = 3
  salesAddresses.forEach(addr => {
    text = text + `$${count++},`
    values.push(addr.id.toString())
  })

  text = text.slice(0, -1) + ')' // remove trailing comma

  dbQuery = {
    text: text,
    values: values
  }

  try {
    await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
  }
}

export async function reactivateSalesOnActiveAddresses(salesAddresses: SalesAddress[]): Promise<void> {
  logger.info("marking 'salesAddressInactive' sales on active addresses as 'active'")

  let dbQuery: QueryConfig<any[]>

  let text: string = 'update public.sales set status = $1 where status = $2 and sales_address_id in('
  let values: string[] = ['active', 'salesAddressInactive']
  let count: number = 3
  salesAddresses.forEach(addr => {
    text = text + `$${count++},`
    values.push(addr.id.toString())
  })

  text = text.slice(0, -1) + ')' // remove trailing comma

  dbQuery = {
    text: text,
    values: values
  }

  try {
    await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
  }
}

export async function insertNftPostMint(filename: string, nftName: string, imageFileName: string, nftMetadata: string,
  mintToAddress: string, mintWalletAddress: string, ipfsLink: string, mintIndex: number, pinataRc: string,
  nodeRequestStr: string, nodeRespCodeStr: string, tokenId: string, table: string, mintTx: string): Promise<void> {
  logger.info(`recording status of mint with tx id: ${nodeRespCodeStr}`)

  const dbQuery: QueryConfig<any[]> = {
    text: `INSERT INTO public.$1 (filename, nft_name, image_name, metadata, mint_to_address, current_address, minted_on, ipfs_url,
            number, pinata_response, node_requests, node_response, token_id, mint_tx)
           VALUES ($2,$3,$4,$5,$6,current_timestamp,$7,$8,$9,$10,$11,$12,$13)`,
    values: [
      `${table}`,
      `${filename}`,
      `${imageFileName}`,
      `${nftMetadata}`,
      `${mintToAddress}`,
      `${mintWalletAddress}`,
      `${ipfsLink}`,
      `${mintIndex}`,
      `${pinataRc}`,
      `${nodeRequestStr}`,
      `${nodeRespCodeStr}`,
      `${tokenId}`,
      `${mintTx}`
    ]
  }

  try {
    await executeDBQuery(dbQuery)
  } catch (e) {
    logger.error({
      message: "DB error in sales scanner",
      error: e.message,
      query_text: dbQuery.text,
      query_values: dbQuery.values
    })
  }
}
