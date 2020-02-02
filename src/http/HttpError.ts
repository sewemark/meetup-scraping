export class HttpError {
    private _responseCode: number;
    private _errorCode: string;
    constructor(responseCode: number, errorCode: string) {
        this._responseCode = responseCode;
        this._errorCode = errorCode;
    }

    public get responseCode(): number {
        return this._responseCode;
    }

    public serialize(): any {
        return {
            status: 'error',
            error: this._errorCode,
        };
    }
}
