import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as url from 'url';
import { ILogger } from '../logger/ILogger';
import { IAsyncTask } from './IAsyncTask';

export class FileDownloadTask implements IAsyncTask {
    private imageUrl: string;
    private userId: string;
    private logger: ILogger;

    constructor(logger: ILogger, imageUrl: string, userId: string) {
        this.imageUrl = imageUrl;
        this.userId = userId;
        this.logger = logger;
    }

    public perform(): Promise<void> {
        const imageLocalPath = this.getImagePath();
        this.logger.info('FileDownloadTask', 'saveImage', `Saving image on file ${imageLocalPath}`);
        const writeImageStream = fs.createWriteStream(imageLocalPath);
        https.get(this.imageUrl, (response: any) => {
            response.pipe(writeImageStream);
        });
        return Promise.resolve();
    }

    private getImagePath(): string {
        const unixTimeStamp = Math.round(+new Date() / 1000);
        const parsedImageUrl = url.parse(this.imageUrl);
        const imageName = path.basename(parsedImageUrl.pathname);
        const directoryPath = path.join(process.cwd(), 'scrapes', unixTimeStamp.toString(), this.userId);
        fs.mkdirSync(directoryPath, { recursive: true });
        return path.join(directoryPath, imageName);
    }
}
