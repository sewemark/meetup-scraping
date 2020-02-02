import { Request, Response } from 'express';
import { InvalidCredentialsError } from '../errors/InvalidCredentialsError';
import { UnableToScrapMeetupPage } from '../errors/UnableToScrapMeetupPage';
import { ILogger } from '../logger/ILogger';
import { MeetupScrapper } from '../services/MeetupScrapper';
import { HttpError } from './HttpError';

export class ScrapperController {
    private logger: ILogger;
    private meetupScrapper: MeetupScrapper;

    constructor(
        logger: ILogger,
        meetupScrapper: MeetupScrapper,
    ) {
        this.logger = logger;
        this.meetupScrapper = meetupScrapper;
    }

    public async scrap(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.meetupScrapper.scrap({
                username: req.body.username,
                password: req.body.password,
            });
            this.sendSuccessResponse(res, result);
        } catch (err) {
            this.sendErrorResponse(res, err);
        }
    }

    private sendSuccessResponse(res: Response, result: any): void {
        res.status(200).json(result);
    }

    private sendErrorResponse(res: Response, err: any): void {
        const httpError = this.getHttpError(err);
        this.logger.error('ScrapperController', 'getHttpError', err, `Sending error response`);
        res.status(httpError.responseCode).json(httpError.serialize());
    }

    private getHttpError(err: any): HttpError {
        switch (err.constructor) {
            case InvalidCredentialsError:
                return new HttpError(400, 'invalid_login');
            case UnableToScrapMeetupPage:
                return new HttpError(400, 'scrape_failed');
            default:
                return new HttpError(500, 'unknown_server_error');
        }
    }
}
