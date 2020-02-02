import { ScrapperController } from "./ScrapperController";

export interface IControllerProvider {
    getScrapperController(): ScrapperController;
}
