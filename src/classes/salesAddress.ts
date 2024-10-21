
export class SalesAddress {

  id: number
  address: string
  currency: string
  version: string
  active: boolean

  constructor(
    id: number,
    address: string,
    currency: string,
    version: string,
    active: boolean
  ) {
    this.id = id
    this.address = address
    this.currency = currency
    this.version = version
    this.active = active
  }
}
