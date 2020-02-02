import { ILogger } from '../logger/ILogger';

export class ServerConfig {
    private _port: number = 8080;
    private logger: ILogger;

    public get port(): number {
        return this._port;
    }

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    public serialize(): any {
        return {
            port: this.port,
        };
    }

    public deserialize(config: any): void {
        if (config.port && Number.isInteger(config.port) && Number(config.port) < Number.MAX_SAFE_INTEGER) {
            this._port = config.port;
        } else {
            this.logger.info(
                'ServerConfig',
                'deserialize',
                `Invalid port value ${config.port}, using default value ${this.port}`,
            );
        }
    }
}
