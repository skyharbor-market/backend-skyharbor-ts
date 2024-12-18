import { getTokenBoxV1, boxByBoxId, txById } from '../ergofunctions/explorer'
import { ergoTreeToAddress } from '../ergofunctions/serializer'
import { Address, AddressKind } from '@coinbarn/ergo-ts/dist/models/address'
import { findTokenCollection } from '../functions/collectionCorrection'
import { getOrCreateCollectionsForMintAddress } from '../scanner/db'
//import logger from "../logger"

export class Token {

  tokenId: string = ""
  creationBox: string = ""
  emmissionCount: number = 0
  decimals: number = 0
  name: string = ""
  description: string = "NULL"
  eipType: string = "" // SHOULD THIS BE NULLABLE???
  artUrl: string = ""
  ipfsArtHash: string = ""
  audio_url: string = "NULL"
  creationHeight: bigint = BigInt(0)
  creationTx: string = ""
  confirmedHeight: bigint = BigInt(0)
  confirmedBlockId: string = ""
  r7TokenType: string = ""
  tokenTypeStr: string = ""
  royalties: boolean = false
  royaltyAddress: string = "NULL"
  royaltyValue: number = 0
  royaltyErgoTree: string = "NULL"
  artHash: string = ""
  mintAddress: string = ""
  collectionSysName: string = "null"
  valid: boolean = false
  existsOnDb: boolean = false

  constructor(tokenId: string) {
    this.tokenId = tokenId
  }

  public toString(): string {
    return ""
  }

  public logInfoOnSelf(logger: any) {
    const msg = {
      message: `token was invalid!`,
      mint_address: this.mintAddress,
      name: this.name,
      desc: this.description,
      artUrl: this.artUrl,
      artHash: this.artHash,
      audioUrl: this.audio_url,
      collection: this.collectionSysName,
      confirmed_in: this.confirmedBlockId,
      conf_height: this.confirmedHeight,
      creation_box: this.creationBox,
      create_height: this.creationHeight,
      creation_tx: this.creationHeight,
      ipfsArtHash: this.ipfsArtHash,
      existing: this.emmissionCount,
      token_id: this.tokenId,
      token_type: this.tokenTypeStr,
      royalty_addr: this.royaltyAddress,
      roy_ergotree: this.royaltyErgoTree,
      royalty_int: this.royaltyValue,
      exists: this.existsOnDb,
      valid: this.valid,
      EIP_type: this.eipType,
    }

    logger.next(Object.assign({}, msg))
  }

  public async getInfoOnSelf(logger: any): Promise<void> {

    this.valid = false

    const tokenInfo = await getTokenBoxV1(this.tokenId)
    if (Object.keys(tokenInfo).length > 0 || tokenInfo.length > 0) {

      this.creationBox = tokenInfo.boxId
      this.emmissionCount = Number(tokenInfo.emissionAmount)
      this.decimals = Number(tokenInfo.decimals)
      this.name = tokenInfo.name
      this.description = tokenInfo.description
      this.eipType = tokenInfo.type

      const boxInfo = await boxByBoxId(this.creationBox)
      logger.next(Object.assign({}, {message: "boxinfo"}, boxInfo))

      if (Object.keys(boxInfo).length > 0 || boxInfo.length > 0) {

        //TODO: get more info on diff types of token via registers, have to decode using decodeString in utils
        // need to do audio and video NFT's.
        //audio have a double coll[byte],coll[byte] data type for the audio,coverimage respectively - CHECK THE EIP

        // get token type, move art links based on typing.
        const regs = boxInfo.additionalRegisters
        this.r7TokenType = regs.R7.renderedValue
        // if image
        if (this.r7TokenType === "0101") {
          this.tokenTypeStr = "image"
          this.artUrl = Buffer.from(regs.R9.renderedValue, 'hex').toString()
          this.artHash = regs.R8.renderedValue
          this.decodeIpfsArtUrl(logger)
        } else if (this.r7TokenType === "0102") {
          this.tokenTypeStr = "audio"
          logger.next({ message: "Token is audio! can't process..", R7: this.r7TokenType })
          return
        } else if (this.r7TokenType === "0103") {
          this.tokenTypeStr = "video"
          this.artUrl = Buffer.from(regs.R9.renderedValue, 'hex').toString()
          this.artHash = regs.R8.renderedValue
          this.decodeIpfsArtUrl(logger)
        } else if (this.r7TokenType === "0201") {
          this.tokenTypeStr = "utility"
          logger.next({ message: "Token is utility! can't process..", R7: this.r7TokenType })
          return
        } else {
          logger.next({ message: "could not detect token type!", R7: this.r7TokenType })
          return
        }

        // get royalty info
        // Is this call correct?
        const preMintBox = await boxByBoxId(this.tokenId)
        if (Object.keys(preMintBox).length > 0 || preMintBox.length > 0) {
          logger.next(Object.assign({}, { message: "preMintBox" }, preMintBox))

          if (Object.keys(preMintBox.additionalRegisters).length > 0) {
            logger.next({ message: "getting royalty info for token id", token_id: this.tokenId })
            let royaltyValueInt: number = 0
            // try and get R4 for royalty value
            try {
              royaltyValueInt = Number(preMintBox.additionalRegisters.R4.renderedValue)
              // check for royalty ergo tree in register R5
              if (!preMintBox.additionalRegisters.hasOwnProperty("R5")) {
                logger.next({
                  message: "register R5 is missing for box id",
                  box_id: this.creationBox,
                  additional_registers: preMintBox.additionalRegisters
                })
                return
              }
              // check for valid royalty amount, between 0 and 200 inclusive.
              if (royaltyValueInt >= 0 && royaltyValueInt <= 200) {
                this.royalties = true
                //this.royaltyValueStr = royaltyValueInt.toString()
                this.royaltyValue = royaltyValueInt
                this.royaltyErgoTree = preMintBox.additionalRegisters.R5.renderedValue
                try {
                  this.royaltyAddress = await ergoTreeToAddress(this.royaltyErgoTree)
                } catch (e) {
                  logger.next({
                    message: `failed to get box id R5 royalty address - ${e}`,
                    box_id: this.creationBox,
                    R4: preMintBox.additionalRegisters.R4,
                    R5: preMintBox.additionalRegisters.R5
                  })
                  return
                }
              }
            } catch (e) {
              logger.next({
                message: `failed to get box id R4 royalty value - ${e}`,
                box_id: this.creationBox,
                R4: preMintBox.additionalRegisters.R4,
                R5: preMintBox.additionalRegisters.R5
              })
              return
            }
          }

          // get mint address
          const issuingBox = await this.getFirstBoxInMintChain(logger, preMintBox)
          logger.next(Object.assign({}, { message: "issuingBox" }, issuingBox))

          if (issuingBox !== null) {
            this.mintAddress = issuingBox.address
            logger.next({ message: "found mint address", mint_address: this.mintAddress })

            //get info on collection from database
            await this.getCollectionName(logger)

            if (this.collectionSysName !== null) {
              //all done, return valid
              this.valid = true
            } else {
              logger.next({ message: "Could not find a valid collection for token", token_id: this.tokenId })
              return
            }
          }
        }
      }
    }
  }

  private decodeIpfsArtUrl(logger: any): void {
    const ipfsTag: string = "ipfs://"
    const ipfsGate: string = "/ipfs/"

    if (this.artUrl.includes(ipfsTag)) {
      this.ipfsArtHash = this.artUrl.substring(this.artUrl.indexOf(ipfsTag) + ipfsTag.length)
    } else if (this.artUrl.includes(ipfsGate)) {
      this.ipfsArtHash = this.artUrl.substring(this.artUrl.indexOf(ipfsGate) + ipfsGate.length)
    } else {
      logger.next({
        message: "could not find ipfs tag for NFT with token ID, not an IPFS image",
        token_id: this.tokenId,
        nft_name: this.name })
      this.ipfsArtHash = "NULL"
    }
  }

  private async getCollectionName(logger: any): Promise<void> {

    const colls: string[] | undefined = await getOrCreateCollectionsForMintAddress(this)
    logger.next({
      message: "called get or create collections for mint address",
      mint_address: this.mintAddress,
      collections: typeof colls === 'undefined' ? "undefined" : colls.toString() })

    if (typeof colls !== 'undefined') {
      if (colls.length === 1) {
        //all done, return
        this.collectionSysName = colls[0]
        return
      } else if (colls.length > 1) {
        this.collectionSysName = findTokenCollection(this)
        return
      }
    }
  }

  private async getFirstBoxInMintChain(logger: any, preMintBox: any): Promise<any> {

    logger.next({ message: "getting first box in mint chain.." })

    let success: boolean = true
    //get the mint address
    let deepPreMintBox = preMintBox
    let addr = new Address(preMintBox.address)

    while (!(addr.getType() === AddressKind.P2PK) && success) {
      //get tx which issued preMintBox
      const preMintBoxTx = await txById(deepPreMintBox.transactionId)

      if (preMintBoxTx.hasOwnProperty("inputs") && preMintBoxTx.inputs.length > 0) {
        //get boxId for first input to that tx and get box details
        const input0BoxId = preMintBoxTx.inputs[0].boxId
        deepPreMintBox = await boxByBoxId(input0BoxId)

        if (deepPreMintBox.hasOwnProperty("address")) {
          addr = new Address(deepPreMintBox.address)
        } else {
          success = false
          logger.next({ message: "could not successfully find info on box", box_id: input0BoxId })
        }

      } else {
        success = false
        logger.next(Object.assign({}, { message: "could not successfully get info on transaction which issued box" }, preMintBox))
      }
    }
    if (success) {
      return deepPreMintBox
    } else {
      return null
    }
  }
}
