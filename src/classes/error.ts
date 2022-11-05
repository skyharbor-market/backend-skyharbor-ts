export class Error {

    public text: string
    public httpCode: number
    public rc: number

    constructor(
        text: string,
        httpCode: number,
        rc: number
    ) {
        this.text = text
        this.httpCode = httpCode
        this.rc = rc
    }
}