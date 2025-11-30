import pool from '../config/database';
import { BaseConnector } from './base.connector';
import { SplunkConnector } from './splunk.connector';
import { CrowdStrikeConnector } from './crowdstrike.connector';
import { ServiceNowConnector } from './servicenow.connector';
import logger from '../utils/logger';

/**
 * Connector Manager - Manages all security tool connectors
 */
export class ConnectorManager {
  private connectors: Map<string, BaseConnector> = new Map();

  /**
   * Initialize all enabled connectors from database
   */
  async initialize(): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT * FROM connector_configs WHERE is_enabled = true'
      );

      for (const config of result.rows) {
        try {
          const connector = this.createConnector(config);
          if (connector) {
            this.connectors.set(config.id, connector);
            logger.info(`Initialized connector: ${config.name}`);
          }
        } catch (error: any) {
          logger.error(`Failed to initialize connector ${config.name}`, { error: error.message });
        }
      }

      logger.info(`Initialized ${this.connectors.size} connectors`);
    } catch (error: any) {
      logger.error('Failed to initialize connectors', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a connector instance based on type
   */
  private createConnector(config: any): BaseConnector | null {
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
          return new SplunkConnector(connectorConfig);
        }
        break;
      
      case 'edr':
        if (config.name.toLowerCase().includes('crowdstrike')) {
          return new CrowdStrikeConnector(connectorConfig);
        }
        break;
      
      case 'cmdb':
      case 'ticketing':
        if (config.name.toLowerCase().includes('servicenow')) {
          return new ServiceNowConnector(connectorConfig);
        }
        break;
    }

    logger.warn(`Unknown connector type or name: ${config.type} - ${config.name}`);
    return null;
  }

  /**
   * Get a specific connector by ID
   */
  getConnector(id: string): BaseConnector | undefined {
    return this.connectors.get(id);
  }

  /**
   * Get all connectors
   */
  getAllConnectors(): BaseConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Test all connector connections
   */
  async testAllConnections(): Promise<{ [key: string]: { healthy: boolean; message: string } }> {
    const results: { [key: string]: { healthy: boolean; message: string } } = {};

    for (const [id, connector] of this.connectors) {
      try {
        const health = await connector.getHealth();
        results[id] = health;
      } catch (error: any) {
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
  async syncAllIncidents(since?: Date): Promise<{ [key: string]: any }> {
    const results: { [key: string]: any } = {};

    for (const [id, connector] of this.connectors) {
      try {
        logger.info(`Starting incident sync for connector: ${id}`);
        const result = await connector.syncIncidents(since);
        results[id] = result;
        
        // Log sync to database
        await pool.query(
          `INSERT INTO sync_logs (
            connector_id,
            sync_type,
            status,
            items_processed,
            items_created,
            items_updated,
            error_count,
            duration_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id,
            'incidents',
            result.success ? 'success' : 'failed',
            result.itemsProcessed,
            result.itemsCreated,
            result.itemsUpdated,
            result.errors.length,
            result.duration
          ]
        );
      } catch (error: any) {
        logger.error(`Failed to sync incidents for connector ${id}`, { error: error.message });
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
  async syncAllAssets(): Promise<{ [key: string]: any }> {
    const results: { [key: string]: any } = {};

    for (const [id, connector] of this.connectors) {
      try {
        logger.info(`Starting asset sync for connector: ${id}`);
        const result = await connector.syncAssets();
        results[id] = result;
        
        // Log sync to database
        await pool.query(
          `INSERT INTO sync_logs (
            connector_id,
            sync_type,
            status,
            items_processed,
            items_created,
            items_updated,
            error_count,
            duration_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id,
            'assets',
            result.success ? 'success' : 'failed',
            result.itemsProcessed,
            result.itemsCreated,
            result.itemsUpdated,
            result.errors.length,
            result.duration
          ]
        );
      } catch (error: any) {
        logger.error(`Failed to sync assets for connector ${id}`, { error: error.message });
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
  async reload(): Promise<void> {
    this.connectors.clear();
    await this.initialize();
    logger.info('Connectors reloaded');
  }
}

// Export singleton instance
export const connectorManager = new ConnectorManager();
