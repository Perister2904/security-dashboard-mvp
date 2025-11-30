import { BaseConnector, ConnectorConfig, SyncResult } from './base.connector';
import pool from '../config/database';
import logger from '../utils/logger';

interface SplunkAlert {
  _key: string;
  _time: number;
  severity: string;
  title: string;
  description: string;
  source: string;
  dest_ip?: string;
  src_ip?: string;
  user?: string;
  host?: string;
}

export class SplunkConnector extends BaseConnector {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/services/server/info', {
        params: { output_mode: 'json' }
      });
      return response.status === 200;
    } catch (error: any) {
      logger.error('Splunk connection test failed', { error: error.message });
      return false;
    }
  }

  async syncIncidents(since?: Date): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [],
      duration: 0
    };

    try {
      // Build search query
      const sinceTime = since ? Math.floor(since.getTime() / 1000) : Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
      
      const search = `search index=security earliest=${sinceTime} | where severity="high" OR severity="critical" | table _time, severity, title, description, source, dest_ip, src_ip, user, host`;
      
      // Create search job
      const searchResponse = await this.client.post(
        '/services/search/jobs',
        `search=${encodeURIComponent(search)}&output_mode=json`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      const searchId = searchResponse.data.sid;

      // Wait for search to complete (with timeout)
      let searchComplete = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!searchComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await this.client.get(`/services/search/jobs/${searchId}`, {
          params: { output_mode: 'json' }
        });

        if (statusResponse.data.entry[0].content.isDone) {
          searchComplete = true;
        }
        attempts++;
      }

      if (!searchComplete) {
        throw new Error('Splunk search timed out');
      }

      // Get search results
      const resultsResponse = await this.client.get(`/services/search/jobs/${searchId}/results`, {
        params: { output_mode: 'json', count: 1000 }
      });

      const alerts: SplunkAlert[] = resultsResponse.data.results || [];
      result.itemsProcessed = alerts.length;

      // Process each alert
      for (const alert of alerts) {
        try {
          // Check if incident already exists
          const existingIncident = await pool.query(
            'SELECT id FROM incidents WHERE source_id = $1 AND source = $2',
            [alert._key, 'splunk']
          );

          const affectedAssets: string[] = [];
          if (alert.dest_ip) {
            const asset = await pool.query(
              'SELECT id FROM assets WHERE ip_address = $1',
              [alert.dest_ip]
            );
            if (asset.rows.length > 0) {
              affectedAssets.push(asset.rows[0].id);
            }
          }

          if (existingIncident.rows.length > 0) {
            // Update existing incident
            await pool.query(
              `UPDATE incidents 
              SET updated_at = NOW()
              WHERE id = $1`,
              [existingIncident.rows[0].id]
            );
            result.itemsUpdated++;
          } else {
            // Create new incident
            await pool.query(
              `INSERT INTO incidents (
                title,
                description,
                severity,
                status,
                source,
                source_id,
                detected_at,
                affected_assets,
                ioc_indicators
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                alert.title || 'Splunk Alert',
                alert.description || '',
                this.normalizeSeverity(alert.severity),
                'new',
                'splunk',
                alert._key,
                new Date(alert._time * 1000),
                affectedAssets,
                JSON.stringify({
                  src_ip: alert.src_ip,
                  dest_ip: alert.dest_ip,
                  user: alert.user,
                  host: alert.host
                })
              ]
            );
            result.itemsCreated++;
          }
        } catch (error: any) {
          result.errors.push(`Failed to process alert ${alert._key}: ${error.message}`);
          logger.error('Error processing Splunk alert', { alert, error: error.message });
        }
      }

      // Update last sync time
      await pool.query(
        `UPDATE connector_configs 
        SET last_sync = NOW(), status = 'active'
        WHERE id = $1`,
        [this.config.id]
      );

    } catch (error: any) {
      result.success = false;
      result.errors.push(`Splunk sync failed: ${error.message}`);
      logger.error('Splunk incident sync failed', { error: error.message });

      await pool.query(
        `UPDATE connector_configs 
        SET status = 'error', last_error = $1
        WHERE id = $2`,
        [error.message, this.config.id]
      );
    }

    result.duration = Date.now() - startTime;
    logger.info('Splunk incident sync completed', result);

    return result;
  }

  async syncAssets(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [],
      duration: 0
    };

    try {
      // Search for asset data in Splunk
      const search = 'search index=assets | table host, ip, os, department | dedup host';
      
      const searchResponse = await this.client.post(
        '/services/search/jobs',
        `search=${encodeURIComponent(search)}&output_mode=json`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      const searchId = searchResponse.data.sid;

      // Wait for search to complete
      let searchComplete = false;
      let attempts = 0;

      while (!searchComplete && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await this.client.get(`/services/search/jobs/${searchId}`, {
          params: { output_mode: 'json' }
        });

        if (statusResponse.data.entry[0].content.isDone) {
          searchComplete = true;
        }
        attempts++;
      }

      if (!searchComplete) {
        throw new Error('Splunk search timed out');
      }

      const resultsResponse = await this.client.get(`/services/search/jobs/${searchId}/results`, {
        params: { output_mode: 'json', count: 5000 }
      });

      const assets = resultsResponse.data.results || [];
      result.itemsProcessed = assets.length;

      for (const asset of assets) {
        try {
          const existingAsset = await pool.query(
            'SELECT id FROM assets WHERE hostname = $1 OR ip_address = $2',
            [asset.host, asset.ip]
          );

          if (existingAsset.rows.length > 0) {
            await pool.query(
              `UPDATE assets 
              SET last_scan = NOW(), updated_at = NOW()
              WHERE id = $1`,
              [existingAsset.rows[0].id]
            );
            result.itemsUpdated++;
          } else {
            await pool.query(
              `INSERT INTO assets (
                name,
                type,
                hostname,
                ip_address,
                os,
                department,
                last_scan
              ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [
                asset.host,
                'server',
                asset.host,
                asset.ip,
                asset.os || 'Unknown',
                asset.department || 'Unknown'
              ]
            );
            result.itemsCreated++;
          }
        } catch (error: any) {
          result.errors.push(`Failed to process asset ${asset.host}: ${error.message}`);
        }
      }

    } catch (error: any) {
      result.success = false;
      result.errors.push(`Splunk asset sync failed: ${error.message}`);
      logger.error('Splunk asset sync failed', { error: error.message });
    }

    result.duration = Date.now() - startTime;
    logger.info('Splunk asset sync completed', result);

    return result;
  }
}
