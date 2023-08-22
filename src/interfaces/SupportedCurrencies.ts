export interface SupportedCurrenciesInterface {
  [key: string]: CurrencyInterface;
  erg: CurrencyInterface;
  sigusd: CurrencyInterface;
}

export interface CurrencyInterface {
  name: string;
  displayName: string;
  id: string;
  decimal: number;
  minSupported: number;
  initial: number;
  contractAddress: string;
}