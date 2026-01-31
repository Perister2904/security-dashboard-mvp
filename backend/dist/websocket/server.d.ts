import { Server as HTTPServer } from 'http';
export declare class WebSocketManager {
    private wss;
    private clients;
    private pingInterval;
    constructor(server: HTTPServer);
    /**
     * Verify client authentication before connection
     */
    private verifyClient;
    /**
     * Handle new WebSocket connection
     */
    private handleConnection;
    /**
     * Handle incoming WebSocket messages
     */
    private handleMessage;
    /**
     * Subscribe client to a channel
     */
    private subscribe;
    /**
     * Unsubscribe client from a channel
     */
    private unsubscribe;
    /**
     * Unsubscribe client from all channels
     */
    private unsubscribeAll;
    /**
     * Send message to a specific client
     */
    private send;
    /**
     * Broadcast message to all clients in a channel
     */
    broadcast(channel: string, data: any): void;
    /**
     * Broadcast new incident to SOC channel
     */
    broadcastNewIncident(incident: any): void;
    /**
     * Broadcast incident update
     */
    broadcastIncidentUpdate(incident: any): void;
    /**
     * Broadcast metrics update
     */
    broadcastMetricsUpdate(metrics: any): void;
    /**
     * Get default channel based on user role
     */
    private getDefaultChannel;
    /**
     * Start heartbeat to detect dead connections
     */
    private startHeartbeat;
    /**
     * Stop heartbeat
     */
    private stopHeartbeat;
    /**
     * Get connection statistics
     */
    getStats(): {
        totalConnections: number;
        channels: {
            [key: string]: number;
        };
    };
    /**
     * Close all connections and stop server
     */
    close(): void;
}
export declare function setupDatabaseTriggers(wsManager: WebSocketManager): Promise<void>;
export default WebSocketManager;
//# sourceMappingURL=server.d.ts.map