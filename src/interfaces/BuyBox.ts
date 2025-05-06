import { SupportedCurrenciesInterface } from "./SupportedCurrencies"

export interface EmptyBuyBoxInterface {
  box_id: string;
}

export interface BuyBoxInterface {
    id: number,
    nft_name: string;
    token_id:string;
    nft_desc: string;
    total_existing: number,
    nft_type: "image",
    ipfs_art_url: string,
    ipfs_art_hash: string,
    ipfs_audio_url: string | null,
    nft_hash: string,
    royalty_int: number | null,
    royalty_address: string | null,
    status: "active" | "inactive"|"complete" | "cancelled",
    nerg_sale_value: number,
    list_time: string,
    seller_address: string,
    seller_ergotree: string,
    buyer_address: string | null,
    buyer_ergotree: string | null,
    completion_time: string | null,
    collection_sys_name: string,
    collection_name: string,
    verified_collection: boolean,
    currency: "erg" | "sigusd",
    decimals: number,
    box_id: string,
    creation_tx: string,
    creation_height: number,
    spent_tx: string | null,
    token_amount: number,
    nerg_service_value: number,
    nerg_royalty_value: number,
    box_json: {
        boxId: string,
        transactionId: string,
        value: number,
        index: number,
        creationHeight: 1074552,
        ergoTree: string,
        address: string,
        assets: [
            {
                tokenId: string,
                index: number,
                amount: number,
                name: string,
                decimals: number,
                type: string
            }
        ],
        additionalRegisters: {
            R4: {
                serializedValue: string,
                sigmaType: string | null,
                renderedValue: number | string | null
            },
            R5: {
                serializedValue: string,
                sigmaType: string | null,
                renderedValue: number | string | null
            },
            R6: {
                serializedValue: string,
                sigmaType: string,
                renderedValue: number | string
            },
            R7: {
                serializedValue: string,
                sigmaType: string | null,
                renderedValue: number | string | null
            }
        },
        spentTransactionId: string | null
    },
    sales_address: string
}
