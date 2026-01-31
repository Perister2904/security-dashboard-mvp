import { AxiosInstance } from 'axios';
export interface ConnectorConfig {
    id: string;
    name: string;
    type: 'siem' | 'edr' | 'cmdb' | 'ticketing' | 'vulnerability_scanner';
    baseUrl: string;
    apiKey?: string;
    username?: string;
    password?: string;
    enabled: boolean;
    syncInterval: number;
    lastSync?: Date;
    config?: Record<string, any>;
}
export interface SyncResult {
    success: boolean;
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    errors: string[];
    duration: number;
}
export declare abstract class BaseConnector {
    protected client: AxiosInstance;
    protected config: ConnectorConfig;
    constructor(config: ConnectorConfig);
    /**
     * Test connection to the external system
     */
    abstract testConnection(): Promise<boolean>;
    /**
     * Sync incidents/alerts from the external system
     */
    abstract syncIncidents(since?: Date): Promise<SyncResult>;
    /**
     * Sync assets from the external system
     */
    abstract syncAssets(): Promise<SyncResult>;
    /**
     * Get connector health status
     */
    getHealth(): Promise<{
        healthy: boolean;
        message: string;
        lastSync?: Date;
    }>;
    /**
     * Normalize severity from external system to standard format
     */
    protected normalizeSeverity(externalSeverity: string): 'critical' | 'high' | 'medium' | 'low';
    /**
     * Normalize status from external system to standard format
     */
    protected normalizeStatus(externalStatus: string): 'new' | 'in-progress' | 'resolved' | 'closed';
    /**
     * Helper to handle paginated API responses
     */
    protected paginateResults<T>(fetchPage: (page: number, pageSize: number) => Promise<{
        items: T[];
        hasMore: boolean;
    }>, pageSize?: number): AsyncGenerator<T[], void, unknown>;
}
//# sourceMappingURL=base.connector.d.ts.map