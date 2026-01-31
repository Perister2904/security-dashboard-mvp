import { BaseConnector } from './base.connector';
/**
 * Connector Manager - Manages all security tool connectors
 */
export declare class ConnectorManager {
    private connectors;
    /**
     * Initialize all enabled connectors from database
     */
    initialize(): Promise<void>;
    /**
     * Create a connector instance based on type
     */
    private createConnector;
    /**
     * Get a specific connector by ID
     */
    getConnector(id: string): BaseConnector | undefined;
    /**
     * Get all connectors
     */
    getAllConnectors(): BaseConnector[];
    /**
     * Test all connector connections
     */
    testAllConnections(): Promise<{
        [key: string]: {
            healthy: boolean;
            message: string;
        };
    }>;
    /**
     * Sync incidents from all connectors
     */
    syncAllIncidents(since?: Date): Promise<{
        [key: string]: any;
    }>;
    /**
     * Sync assets from all connectors
     */
    syncAllAssets(): Promise<{
        [key: string]: any;
    }>;
    /**
     * Reload connectors from database
     */
    reload(): Promise<void>;
}
export declare const connectorManager: ConnectorManager;
//# sourceMappingURL=index.d.ts.map