export class SqlQuery {

    public text: string
    public params: any[]

    constructor(
        text: string,
        params: any[]
    ) {
        this.text = text
        this.params = params
    }
}