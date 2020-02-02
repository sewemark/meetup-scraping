import * as bodyParser from 'body-parser';
import { Express, Request, Response } from 'express';
import { ServerConfig } from './config/ServerConfig';
import { IControllerProvider } from './http/IControllerProvider';
import { ILogger } from './logger/ILogger';
const cors = require('cors');

export class ApiServer {
  private logger: ILogger;
  private app: Express;
  private serverConfig: ServerConfig;
  private controllerProvider: IControllerProvider;

  constructor(
    logger: ILogger,
    serverConfig: ServerConfig,
    app: Express,
    controllerProvider: IControllerProvider,
  ) {
    this.logger = logger;
    this.serverConfig = serverConfig;
    this.app = app;
    this.controllerProvider = controllerProvider;
  }

  public start() {
    this.registerMiddlewares();
    this.registerRoutes();
    this.startListening();
  }

  private registerMiddlewares(): void {
    this.app.use(bodyParser.urlencoded({ extended: false }))
    this.app.use(bodyParser.json());
    this.app.use(cors());
  }

  private registerRoutes(): void {
    this.logger.info('ApiServer', 'registerRoutes', 'Registering routes...');
    const scrapperController = this.controllerProvider.getScrapperController();
    this.app.post('/scrape', scrapperController.scrap.bind(scrapperController));
    this.app.use((err: any, req: Request, res: Response, next: any) =>
      res.status(422).send({ error: err.message }),
    );
  }

  private startListening() {
    this.app.listen(this.serverConfig.port || 3000, () => {
      this.logger.info('ApiServer', 'startApp', `Server listening on  ${this.serverConfig.port}`);
    });
  }
}
