import { EventEmitter } from 'events';
import express from 'express';
import { ApiServer } from './ApiServer';
import { initContainer } from './Bootstrap';
import { YamlConfigProvider } from './config/YamlConfigProvider';
import { DownloadUserImageEvent } from './events/DownloadUserImageEvent';
import { ControllerProvider } from './http/ControllerProvider';
import { ILogger } from './logger/ILogger';
import { Logger } from './logger/Logger';
import { IMessageBus } from './messageBus/IMessageBus';
import { MeetupScrapper } from './services/MeetupScrapper';
import { FileDownloadTask } from './tasks/FileDownloadTask';
import { Types } from './Types';

(async () => {
    function registerEventListners(logger: ILogger, memoryMessageBus: IMessageBus) {
        memoryMessageBus.on(DownloadUserImageEvent.EVENT_NAME, (data: DownloadUserImageEvent) => {
            logger.info(`[Event] ${DownloadUserImageEvent.EVENT_NAME}`, 'ocurred', `event data ${data.userId} ${data.imageUrl}`);
            const fileDownloadTaks = new FileDownloadTask(logger, data.imageUrl, data.userId);
            fileDownloadTaks.perform();
        });
    }

    try {
        const startupLogger = new Logger();
        const configProvider = new YamlConfigProvider(startupLogger);
        const configName = process.argv.indexOf('--debug') >= 0 ? 'config-dev.yml' : 'config.yml';
        const config = await configProvider.import('.', configName);
        const container = initContainer();
        const logger = container.get<ILogger>(Types.Logger);
        const memoryMessageBus = new EventEmitter();
        registerEventListners(logger, memoryMessageBus);
        const meetupScrapper = new MeetupScrapper(logger, memoryMessageBus);
        const server = new ApiServer(
            logger,
            config,
            express(),
            new ControllerProvider(logger, meetupScrapper),
        );
        server.start();
    } catch (err) {
        console.log('Error occured ' + err.stack);
    }
})();
