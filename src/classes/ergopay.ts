
export enum Severity {
    NONE = "NONE",
    INFORMATION = "INFORMATION",
    WARNING = "WARNING",
    ERROR = "ERROR"
}

export class ErgoPayResponse {

    constructor(
        message?: string,
        messageSeverity?: Severity,
        address?: string,
        reducedTx?: string | RegExpMatchArray | null,
        replyTo?: string
    ) {
        this.message = message
        this.messageSeverity = messageSeverity
        this.address = address
        this.reducedTx = reducedTx
        this.replyTo = replyTo
    }
    message?: string
    messageSeverity?: Severity
    address?: string
    reducedTx?: string | RegExpMatchArray | null
    replyTo?: string

}

export class ErgoPayReply {
    constructor(txId: string) {
        this.txId = txId
    }
    txId: string
}