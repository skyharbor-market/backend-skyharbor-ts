export type Currency = "erg" | "sigusd";

export default interface NftAsset {
  id: string; // token_id
  price?: number;
  currency: Currency;
}
