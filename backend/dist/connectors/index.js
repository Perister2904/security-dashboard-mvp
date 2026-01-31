"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectorManager = exports.ConnectorManager = void 0;
const database_1 = __importDefault(require("../config/database"));
const splunk_connector_1 = require("./splunk.connector");
const crowdstrike_connector_1 = require("./crowdstrike.connector");
const servicenow_connector_1 = require("./servicenow.connector");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Connector Manager - Manages all security tool connectors
 */
class ConnectorManager {
    connectors = new Map();
    /**
     * Initialize all enabled connectors from database
     */
    async initialize() {
        try {
            const result = await database_1.default.query('SELECT * FROM connector_configs WHERE is_enabled = true');
            for (const config of result.rows) {
                try {
                    const connector = this.createConnector(config);
                    if (connector) {
                        this.connectors.set(config.id, connector);
                        logger_1.default.info(`Initialized connector: ${config.name}`);
                    }
                }
                catch (error) {
                    logger_1.default.error(`Failed to initialize connector ${config.name}`, { error: error.message });
                }
            }
            logger_1.default.info(`Initialized ${this.connectors.size} connectors`);
        }
        catch (error) {
            logger_1.default.error('Failed to initialize connectors', { error: error.message });
            throw error;
        }
    }
    /**
     * Create a connector instance based on type
     */
    createConnector(config) {
        const connectorConfig = {
            id: config.id,
            name: config.name,
            type: config.type,
            baseUrl: config.base_url,
            apiKey: config.api_key,
            username: config.username,
            password: config.password,
            enabled: config.enabled,
            syncInterval: config.sync_interval,
            lastSync: config.last_sync,
            config: config.config
        };
        switch (config.type) {
            case 'siem':
                if (config.name.toLowerCase().includes('splunk')) {
                    return new splunk_connector_1.SplunkConnector(connectorConfig);
                }
                break;
            case 'edr':
                if (config.name.toLowerCase().includes('crowdstrike')) {
                    return new crowdstrike_connector_1.CrowdStrikeConnector(connectorConfig);
                }
                break;
            case 'cmdb':
            case 'ticketing':
                if (config.name.toLowerCase().includes('servicenow')) {
                    return new servicenow_connector_1.ServiceNowConnector(connectorConfig);
                }
                break;
        }
        logger_1.default.warn(`Unknown connector type or name: ${config.type} - ${config.name}`);
        return null;
    }
    /**
     * Get a specific connector by ID
     */
    getConnector(id) {
        return this.connectors.get(id);
    }
    /**
     * Get all connectors
     */
    getAllConnectors() {
        return Array.from(this.connectors.values());
    }
    /**
     * Test all connector connections
     */
    async testAllConnections() {
        const results = {};
        for (const [id, connector] of this.connectors) {
            try {
                const health = await connector.getHealth();
                results[id] = health;
            }
            catch (error) {
                results[id] = {
                    healthy: false,
                    message: error.message
                };
            }
        }
        return results;
    }
    /**
     * Sync incidents from all connectors
     */
    async syncAllIncidents(since) {
        const results = {};
        for (const [id, connector] of this.connectors) {
            try {
                logger_1.default.info(`Starting incident sync for connector: ${id}`);
                const result = await connector.syncIncidents(since);
                results[id] = result;
                // Log sync to database
                await database_1.default.query(`INSERT INTO sync_logs (
            connector_id,
            sync_type,
            status,
            items_processed,
            items_created,
            items_updated,
            error_count,
            duration_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                    id,
                    'incidents',
                    result.success ? 'success' : 'failed',
                    result.itemsProcessed,
                    result.itemsCreated,
                    result.itemsUpdated,
                    result.errors.length,
                    result.duration
                ]);
            }
            catch (error) {
                logger_1.default.error(`Failed to sync incidents for connector ${id}`, { error: error.message });
                results[id] = {
                    success: false,
                    error: error.message
                };
            }
        }
        return results;
    }
    /**
     * Sync assets from all connectors
     */
    async syncAllAssets() {
        const results = {};
        for (const [id, connector] of this.connectors) {
            try {
                logger_1.default.info(`Starting asset sync for connector: ${id}`);
                const result = await connector.syncAssets();
                results[id] = result;
                // Log sync to database
                await database_1.default.query(`INSERT INTO sync_logs (
            connector_id,
            sync_type,
            status,
            items_processed,
            items_created,
            items_updated,
            error_count,
            duration_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                    id,
                    'assets',
                    result.success ? 'success' : 'failed',
                    result.itemsProcessed,
                    result.itemsCreated,
                    result.itemsUpdated,
                    result.errors.length,
                    result.duration
                ]);
            }
            catch (error) {
                logger_1.default.error(`Failed to sync assets for connector ${id}`, { error: error.message });
                results[id] = {
                    success: false,
                    error: error.message
                };
            }
        }
        return results;
    }
    /**
     * Reload connectors from database
     */
    async reload() {
        this.connectors.clear();
        await this.initialize();
        logger_1.default.info('Connectors reloaded');
    }
}
exports.ConnectorManager = ConnectorManager;
// Export singleton instance
exports.connectorManager = new ConnectorManager();
//# sourceMappingURL=index.js.map