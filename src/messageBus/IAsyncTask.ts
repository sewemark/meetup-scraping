export interface IAsyncTask {
    perform(): Promise<void>;
}
