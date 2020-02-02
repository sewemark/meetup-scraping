import { ILogger } from '../logger/ILogger';
import { MeetupScrapper } from '../services/MeetupScrapper';
import { IControllerProvider } from './IControllerProvider';
import { ScrapperController } from './ScrapperController';

export class ControllerProvider implements IControllerProvider {
    private logger: ILogger;
    private scrapperController: ScrapperController;

    constructor(
        logger: ILogger,
        meetupScrapper: MeetupScrapper,
    ) {
        this.logger = logger;
        this.scrapperController = new ScrapperController(logger, meetupScrapper);
    }

    public getScrapperController(): ScrapperController {
        this.logger.info('ControllerProvider', 'getScrapperController', 'Getting scrapper controller');
        return this.scrapperController;
    }
}
