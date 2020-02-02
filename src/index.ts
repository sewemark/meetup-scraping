import { ApiServer } from './ApiServer';
import { initContainer } from './Bootstrap';
import { YamlConfigProvider } from './config/YamlConfigProvider';
import { ILogger } from './logger/ILogger';
import { Logger } from './logger/Logger';
import { Types } from './Types';
import express from 'express';
import { MeetupScrapper } from './services/MeetupScrapper';

(async () => {
    try {
        const startupLogger = new Logger();
        const configProvider = new YamlConfigProvider(startupLogger);
        const configName = process.argv.indexOf('--debug') >= 0 ? 'config-dev.yml' : 'config.yml';
        const config = await configProvider.import('.', configName);
        const container = initContainer();
        const logger = container.get<ILogger>(Types.Logger);
        const server = new ApiServer(
            logger,
            config,
            express(),
            new MeetupScrapper(logger),
        );
        server.start();
    } catch (err) {
        console.log('Error occured ' + err.stack);
    }
})();
