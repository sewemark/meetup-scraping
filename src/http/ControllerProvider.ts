import { ILogger } from "../logger/ILogger";
import { MeetupScrapper } from "../services/MeetupScrapper";
import { IControllerProvider } from "./IControllerProvider";
import { ScrapperController } from "./ScrapperController";

export class ControllerProvider implements IControllerProvider {
    private logger: ILogger;
    private meetupScrapper: MeetupScrapper;
    private scrapperController: ScrapperController;

    constructor(
        logger: ILogger,
        meetupScrapper: MeetupScrapper,
    ) {
        this.scrapperController = new ScrapperController(logger, meetupScrapper);
    }

    public getScrapperController(): ScrapperController {
        return this.scrapperController;
    }
}
