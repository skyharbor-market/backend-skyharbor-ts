import { getTokenBoxV1, boxByBoxId, txById } from '../ergofunctions/explorer'
import { ergoTreeToAddress } from '../ergofunctions/serializer'
import { Address, AddressKind } from '@coinbarn/ergo-ts/dist/models/address'
import { findTokenCollection } from '../functions/collectionCorrection'
import { getOrCreateCollectionsForMintAddress } from '../scanner/db'

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
  royaltiesV2Array: any[] = []
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
      message: "token was invalid!",
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
      roy_addr: this.royaltyAddress,
      roy_ergotree: this.royaltyErgoTree,
      roy_v2_arr: this.royaltiesV2Array,
      roy_int: this.royaltyValue,
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
          // EIP SPEC - https://github.com/ergoplatform/eips/blob/master/eip-0004.md#ergo-asset-types
          // audio NFTs can either be
          //   R9 - Coll[SByte] - (audio)ipfs://bafybeibd54zkapzgvetwcr...
          //
          //   R9 - (Coll[SByte], Coll[SByte]) - (audio)[ipfs://bafybeigeqb6srly...],(image cover)[ipfs://bafybeicduvhleu...]
          this.tokenTypeStr = "audio"
          if (regs.R9.sigmaType === "Coll[SByte]") {
            this.audio_url = Buffer.from(regs.R9.renderedValue, 'hex').toString()
          } else if (regs.R9.sigmaType === "(Coll[SByte], Coll[SByte])") {
            // Remove outer brackets and split into array of audio and image cover
            const audioLinks = regs.R9.renderedValue.slice(1, -1).split(',')
            this.audio_url = Buffer.from(audioLinks[0], 'hex').toString()
            this.artUrl = Buffer.from(audioLinks[1], 'hex').toString()
          }
          this.artHash = regs.R8.renderedValue
          this.decodeIpfsArtUrl(logger)
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
        const preMintBox = await boxByBoxId(this.tokenId)
        if (Object.keys(preMintBox).length > 0 || preMintBox.length > 0) {
          // boxId == token_id
          logger.next(Object.assign({}, { message: "preMintBox" }, preMintBox))

          if (Object.keys(preMintBox.additionalRegisters).length > 0) {
            // check for R4 and R5 registers
            const regs: string[] = ["R4", "R5"]
            regs.forEach((r) => {
              if (!preMintBox.additionalRegisters.hasOwnProperty(r)) {
                logger.next({
                  message: `register ${r} is missing for box id`,
                  box_id: this.creationBox,
                  additional_registers: preMintBox.additionalRegisters
                })
                return
              }
            })

            let royaltyValueInt: number = 0
            // try and get R4 for royalty value
            try {
              // Handle V1 of the Artwork Standard - https://github.com/ergoplatform/eips/blob/master/eip-0024.md
              if (preMintBox.additionalRegisters.R4.sigmaType === "Int" ||
                (preMintBox.additionalRegisters.R4.sigmaType === "SInt" && preMintBox.additionalRegisters.R5.sigmaType !== "Coll[(Coll[SByte], SInt)]")) {
                royaltyValueInt = Number(preMintBox.additionalRegisters.R4.renderedValue)
                // check for valid royalty amount, between 0 and 200 inclusive.
                if (royaltyValueInt >= 0 && royaltyValueInt <= 200) {
                  this.royalties = true
                  this.royaltyValue = royaltyValueInt
                  this.royaltyErgoTree = preMintBox.additionalRegisters.R5.renderedValue
                  try {
                    this.royaltyAddress = await ergoTreeToAddress(this.royaltyErgoTree)
                  } catch (e) {
                    logger.next({
                      message: "failed to get box id R5 royalty address",
                      error: e,
                      level: "error",
                      box_id: this.creationBox,
                      token_id: this.tokenId,
                      roy_ergotree: this.royaltyErgoTree,
                      R4: preMintBox.additionalRegisters.R4,
                      R5: preMintBox.additionalRegisters.R5
                    })
                    return
                  }

                  // convert V1 royalty standard to fit V2 so we can add them to the royalties db table later
                  const royalty = [this.royaltyAddress, this.royaltyErgoTree, this.royaltyValue]
                  this.royaltiesV2Array.push(royalty)
                }
              } // V2 of the Artwork Standard
              else if (preMintBox.additionalRegisters.R4.sigmaType === "SInt" && preMintBox.additionalRegisters.R4.renderedValue === "2") {
                if (preMintBox.additionalRegisters.R5.renderedValue !== "[]") {
                  // need to convert a string representation of a 2 dimensional array
                  this.royalties = true
                  this.royaltyValue = -1
                  // Replace square brackets with JSON-compatible format by wrapping strings in quotes
                  const royArray = preMintBox.additionalRegisters.R5.renderedValue.replace(/([a-fA-F0-9]+)/g, '"$1"')
                  const royArrayJson = JSON.parse(royArray)

                  const royaltyArray = []
                  // Parse each pair into sub-array
                  for (var royalty = 0; royalty < royArrayJson.length; royalty++) {
                    let royaltyAddress = ""
                    try {
                      royaltyAddress = await ergoTreeToAddress(royArrayJson[royalty][0])
                    } catch (e) {
                      logger.next({
                        message: "failed to get box id R5 royalty address",
                        error: e,
                        level: "error",
                        box_id: this.creationBox,
                        token_id: this.tokenId,
                        roy_ergotree: royArrayJson[royalty][0],
                        R4: preMintBox.additionalRegisters.R4,
                        R5: preMintBox.additionalRegisters.R5
                      })
                      return
                    }
                    royaltyArray.push([royaltyAddress, royArrayJson[royalty][0], parseInt(royArrayJson[royalty][1])])
                  }

                  this.royaltiesV2Array = royaltyArray
                }
              } else {
                logger.next({
                  message: "unknown artwork type based on register R4",
                  box_id: this.creationBox,
                  additional_registers: preMintBox.additionalRegisters
                })
                return
              }
            } catch (e) {
              logger.next({
                message: "failed to get box id R4 royalty value",
                error: e,
                level: "error",
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
