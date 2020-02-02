export class DownloadUserImageEvent {
    public static EVENT_NAME = 'download-user-image';
    private _imageUrl: string;
    private _userId: string;

    constructor(imageUrl: string, userId: string) {
        this._imageUrl = imageUrl;
        this._userId = userId;
    }

    public get imageUrl(): string {
        return this._imageUrl;
    }

    public get userId(): string {
        return this._userId;
    }
}
