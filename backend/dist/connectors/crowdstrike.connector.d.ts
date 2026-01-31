import { BaseConnector, ConnectorConfig, SyncResult } from './base.connector';
export declare class CrowdStrikeConnector extends BaseConnector {
    constructor(config: ConnectorConfig);
    testConnection(): Promise<boolean>;
    syncIncidents(since?: Date): Promise<SyncResult>;
    syncAssets(): Promise<SyncResult>;
}
//# sourceMappingURL=crowdstrike.connector.d.ts.map