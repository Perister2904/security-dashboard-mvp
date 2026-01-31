import { BaseConnector, ConnectorConfig, SyncResult } from './base.connector';
export declare class ServiceNowConnector extends BaseConnector {
    constructor(config: ConnectorConfig);
    testConnection(): Promise<boolean>;
    syncIncidents(since?: Date): Promise<SyncResult>;
    syncAssets(): Promise<SyncResult>;
}
//# sourceMappingURL=servicenow.connector.d.ts.map