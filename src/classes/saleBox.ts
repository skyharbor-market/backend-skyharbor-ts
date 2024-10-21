import logger from "../logger"
import { SalesAddress } from './salesAddress'

export class SaleBox {

  address?: string
  boxJsonStr?: string = ""
  boxId?: string
  creationTx?: string
  spent?: boolean
  spentTx?: string = "null"
  creationHeight?: number
  tokenId?: string
  tokenAmount?: bigint
  decimals?: number
  tokenName?: string
  tokenEIP?: string
  nergSaleValue?: bigint      // r4
  sellerErgoTree: string = "" // r5
  validSale?: boolean
  salesAddress?: SalesAddress
  tokenType?: string

  constructor(
    address?: string,
    boxJsonStr?: string,
    boxId?: string,
    creationTx?: string,
    spent?: boolean,
    spentTx?: string,
    creationHeight?: number,
    tokenId?: string,
    tokenAmount?: bigint,
    decimals?: number,
    tokenName?: string,
    tokenEIP?: string,
    nergSaleValue?: bigint,
    sellerErgoTree: string = "",
    validSale?: boolean
  ) {
    this.address = address
    this.boxJsonStr = boxJsonStr
    this.boxId = boxId
    this.creationTx = creationTx
    this.spent = spent
    this.spentTx = spentTx
    this.creationHeight = creationHeight
    this.tokenId = tokenId
    this.tokenAmount = tokenAmount
    this.decimals = decimals
    this.tokenName = tokenName
    this.tokenEIP = tokenEIP
    this.nergSaleValue = nergSaleValue
    this.sellerErgoTree = sellerErgoTree
    this.validSale = validSale
  }

  public static fromJson(json: any): SaleBox {
    var salebox = new SaleBox(
      json.address.toString(),
      json.toString(),
      json.boxId.toString()
    )

    return salebox
  }

  public static decodeBox(logger: any, utxo: any): SaleBox {
    try {
      let sb = new SaleBox()
      //unspent boxes and spent boxes can come through the same process???
      if (utxo.hasOwnProperty("spentTransactionId") && utxo.spentTransactionId !== null) {
        sb.spentTx = utxo.spentTransactionId
        sb.spent = true
      } else {
        sb.spent = false
      }

      sb.validSale = true

      //null checks..
      let token
      let decimals = 0
      if (utxo.hasOwnProperty("assets")) {
        if (utxo.assets.length > 0) {
          token = utxo.assets[0]
          if (token.hasOwnProperty("name") && token.name === null) {
            sb.validSale = false
          }

          if (token.hasOwnProperty("decimals")&& token.decimals !== null && sb.validSale) {
            decimals = Number(token.decimals)
          }

          if (token.hasOwnProperty("type") && token.type === null && sb.validSale) {
            sb.validSale = false
          }
        }
      }

      let regs
      let saleValue = BigInt(0)
      let sellerErgoTree = ""
      if (utxo.hasOwnProperty("additionalRegisters")) {
        regs = utxo.additionalRegisters
        if (regs.hasOwnProperty("R4")) {
          if (regs.R4.hasOwnProperty("renderedValue")) {
            saleValue = BigInt(regs.R4.renderedValue)
          }
        } else {
          logger.next({ message: "Could not find R4, sale value! sales box invalid" })
          sb.validSale = false
        }

        if (regs.hasOwnProperty("R5")) {
          if (regs.R4.hasOwnProperty("renderedValue")) {
            sellerErgoTree = regs.R5.renderedValue.toString()
          }
        } else {
          logger.next({ message: "Could not find R5, seller ergotree! sales box invalid" })
          sb.validSale = false
        }
      }

      if (sb.validSale) {
        sb = new SaleBox(
          utxo.address,
          JSON.stringify(utxo),
          utxo.boxId,
          utxo.transactionId,
          sb.spent,
          sb.spentTx,
          Number(utxo.creationHeight),
          token.tokenId,
          BigInt(token.amount),
          decimals,
          token.name,
          token.type,
          saleValue,
          sellerErgoTree,
          sb.validSale
        )
      }

      return sb
    } catch (error) {
      throw error
    }
  }

}
