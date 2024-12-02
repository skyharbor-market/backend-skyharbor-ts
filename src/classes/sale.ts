import { SaleBox } from './saleBox'
import { Token } from './token'
import { ergoTreeToAddress } from '../ergofunctions/serializer'
// TODO: change this to use the node API if possible
import { txById } from '../ergofunctions/explorer'

type SaleOption = (s: Sale) => void

export class Sale extends SaleBox {

  sellerAddr: string = ""
  status: string = ""
  collection: string = ""
  buyerErgoTree: string = "null"
  buyerAddr: string = "null"
  nergServiceValue: bigint = BigInt(0)
  nergRoyaltyValue: bigint = BigInt(0)
  royaltyErgoTree: string = "null"

  constructor(sb: SaleBox, ...options: SaleOption[]) {
    super()
    this.salesAddress = sb.salesAddress
    this.boxJsonStr = sb.boxJsonStr
    this.boxId = sb.boxId
    this.creationTx = sb.creationTx
    this.spent = sb.spent
    this.spentTx = sb.spentTx
    this.creationHeight = sb.creationHeight
    this.tokenId = sb.tokenId
    this.tokenAmount = sb.tokenAmount
    this.decimals = sb.decimals
    this.tokenName = sb.tokenName
    this.tokenEIP = sb.tokenEIP
    this.nergSaleValue = sb.nergSaleValue
    this.sellerErgoTree = sb.sellerErgoTree
    if (typeof sb.nergSaleValue !== 'undefined') { this.nergServiceValue = sb.nergSaleValue / BigInt(50) }

    // set the options
    for (const option of options) {
      option(this)
    }
  }

  public static async CreateValidSale(logger: any, saleBox: SaleBox, token?: Token): Promise<Sale> {
    const sale = new Sale(saleBox, await Sale.WithSellerAddr(saleBox.sellerErgoTree))

    if (typeof token !== "undefined") {
      sale.addRoyaltyInfo(token)
    }

    // if sale is complete
    if (saleBox.spent) {
      sale.updateSaleAfterSpend(logger)
    } else {
      sale.status = "active"
    }

    return sale
  }

  // Since async constructors are not allowed, we needed to use the Async Option Constructor model
  // declaration, i.e.
  // const sale = new Sale(saleBox, await Sale.WithSellerAddr(saleBox.sellerErgoTree))
  public static async WithSellerAddr(sellerErgoTree: string): Promise<SaleOption> {
    const addr = await ergoTreeToAddress(sellerErgoTree)
    return (s: Sale): void => {
      s.sellerAddr = addr
    }
  }

  public addRoyaltyInfo(t: Token): void {
    if (t.royalties) {
      if (typeof this.nergSaleValue !== 'undefined') {
        this.nergRoyaltyValue = this.nergSaleValue * (BigInt(t.royaltyValueStr) / BigInt(1000))
        this.royaltyErgoTree = t.royaltyErgoTree
      }
    }
  }

  public async updateSaleAfterSpend(logger: any): Promise<void> {
    logger.next({ message: `box ${this.boxId} is spent! decoding spending result, sale or cancel...` })

    //get details on the tx from the API
    const tx = await txById(this.spentTx)
    logger.next(Object.assign({}, { message: "tx" }, tx))

    let outputCount: number = 0
    if (tx.hasOwnProperty("outputs")) {
      //get outputs of spendTx
      outputCount = tx.outputs.length

      // for (Object obj :outputs ) {

      //   outputCount++;

      //   // output back to seller can no longer be trusted, but kras tells me that there will always be 2 outputs for a cancellation, do that below.
      //   // //if output was back to seller
      //   // if (o.get("address").getAsString().equals(this.sellerAddr)) {
      //   //     JsonArray assets = o.get("assets").getAsJsonArray();
      //   //     //and contained the tokenId being sold
      //   //     for (Object obj2: assets) {
      //   //         JsonObject o2 = (JsonObject) obj2;
      //   //         if(o2.get("tokenId").getAsString().equals(this.tokenId)) {
      //   //             cancelled = true;
      //   //         }
      //   //     }
      //   // }
      // }

      if (outputCount <= 3) {
        this.status = "cancelled";
      } else if (outputCount >= 4) { // get buyer et and addr if sale completed
        this.status = "complete";

        tx.outputs.forEach((output: any) => {
          output.assets.forEach((asset: any) => {
            if (asset.tokenId === this.tokenId) {
              this.buyerAddr = output.address
              this.buyerErgoTree = output.ergoTree
            }
          })
        })
      }
    } else {
      logger.next({ message: "Could not retrieve info on spending tx! setting sale back to inactive.." })
      this.status = "inactive"
    }
  }
}
