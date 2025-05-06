
export class PaymentData {

  address: string
  nanoErgAmount: number
  inboundTxnId?: string
  outgoingTxnId?: string
  responseCode?: number

  constructor(
    address: string,
    nanoErgAmount: number,
    inboundTxnId?: string,
    outgoingTxnId?: string,
    responseCode?: number
  ) {
    this.inboundTxnId = inboundTxnId
    this.outgoingTxnId = outgoingTxnId
    this.responseCode = responseCode
    this.address = address
    this.nanoErgAmount = nanoErgAmount
  }

}
