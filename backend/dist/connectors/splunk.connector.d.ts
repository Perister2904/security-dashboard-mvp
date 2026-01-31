import { BaseConnector, ConnectorConfig, SyncResult } from './base.connector';
export declare class SplunkConnector extends BaseConnector {
    constructor(config: ConnectorConfig);
    testConnection(): Promise<boolean>;
    syncIncidents(since?: Date): Promise<SyncResult>;
    syncAssets(): Promise<SyncResult>;
}
//# sourceMappingURL=splunk.connector.d.ts.map