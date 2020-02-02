import * as bodyParser from 'body-parser';
import { Express, Request, Response } from 'express';
import { ServerConfig } from './config/ServerConfig';
import { ILogger } from './logger/ILogger';
import { MeetupScrapper } from './services/MeetupScrapper';
const cors = require('cors');

export class ApiServer {
  private logger: ILogger;
  private app: Express;
  private serverConfig: ServerConfig;
  private meetupService: MeetupScrapper;

  constructor(
    logger: ILogger,
    serverConfig: ServerConfig,
    app: Express,
    meetupService: MeetupScrapper
  ) {
    this.logger = logger;
    this.serverConfig = serverConfig;
    this.app = app;
    this.meetupService = meetupService;
  }

  public start() {
    this.registerMiddlewares();
    this.registerRoutes();
    this.startListening();
  }

  private registerMiddlewares(): void {
    this.app.use(bodyParser.json());
    this.app.use(cors());
  }

  private registerRoutes(): void {
    this.logger.info('ApiServer', 'registerRoutes', 'Registering routes...');
    this.app.get('/api/test', (req: Request, res: Response, next: Function) => {
      res.status(200).send('Ok');
    });
    this.app.post('/scrape', async (req: Request, res: Response, next: Function) => {
      const result = await this.meetupService.scrap({
        username: req.body.username,
        password: req.body.password,
      });
      console.log(result);
      return res.status(200).json(result);
    });
    this.app.use((err: any, req: Request, res: Response, next: any) =>
      res.status(422).send({ error: err.message }),
    );
  }

  private startListening() {
    this.app.listen(process.env.PORT || this.serverConfig.port || 8081, () => {
      this.logger.info('ApiServer', 'startApp', `Server listening on  ${this.serverConfig.port}`);
    });
  }
}
