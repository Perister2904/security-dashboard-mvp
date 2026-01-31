"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrowdStrikeConnector = void 0;
const base_connector_1 = require("./base.connector");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
class CrowdStrikeConnector extends base_connector_1.BaseConnector {
    constructor(config) {
        super(config);
    }
    async testConnection() {
        try {
            const response = await this.client.get('/sensors/queries/sensors/v1', {
                params: { limit: 1 }
            });
            return response.status === 200;
        }
        catch (error) {
            logger_1.default.error('CrowdStrike connection test failed', { error: error.message });
            return false;
        }
    }
    async syncIncidents(since) {
        const startTime = Date.now();
        const result = {
            success: true,
            itemsProcessed: 0,
            itemsCreated: 0,
            itemsUpdated: 0,
            errors: [],
            duration: 0
        };
        try {
            // Get detection IDs
            const sinceTime = since
                ? new Date(since).toISOString()
                : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const idsResponse = await this.client.get('/detects/queries/detects/v1', {
                params: {
                    filter: `created_timestamp:>='${sinceTime}'+status:['new','in_progress']`,
                    limit: 500,
                    sort: 'created_timestamp.desc'
                }
            });
            const detectionIds = idsResponse.data.resources || [];
            if (detectionIds.length === 0) {
                result.duration = Date.now() - startTime;
                return result;
            }
            // Get full detection details
            const detailsResponse = await this.client.post('/detects/entities/summaries/GET/v1', {
                ids: detectionIds
            });
            const detections = detailsResponse.data.resources || [];
            result.itemsProcessed = detections.length;
            for (const detection of detections) {
                try {
                    // Check if incident already exists
                    const existingIncident = await database_1.default.query('SELECT id FROM incidents WHERE source_id = $1 AND source = $2', [detection.detection_id, 'crowdstrike']);
                    // Find affected asset
                    const affectedAssets = [];
                    if (detection.device?.hostname || detection.device?.local_ip) {
                        const asset = await database_1.default.query('SELECT id FROM assets WHERE hostname = $1 OR ip_address = $2', [detection.device.hostname, detection.device.local_ip]);
                        if (asset.rows.length > 0) {
                            affectedAssets.push(asset.rows[0].id);
                        }
                    }
                    // Map CrowdStrike severity (1-100) to our severity
                    let severity;
                    if (detection.max_severity >= 70)
                        severity = 'critical';
                    else if (detection.max_severity >= 50)
                        severity = 'high';
                    else if (detection.max_severity >= 30)
                        severity = 'medium';
                    else
                        severity = 'low';
                    const title = detection.behaviors[0]?.display_name || 'CrowdStrike Detection';
                    const description = detection.behaviors.map(b => b.description).join('\n\n');
                    if (existingIncident.rows.length > 0) {
                        // Update existing incident
                        await database_1.default.query(`UPDATE incidents 
              SET status = $1, updated_at = NOW()
              WHERE id = $2`, [this.normalizeStatus(detection.status), existingIncident.rows[0].id]);
                        result.itemsUpdated++;
                    }
                    else {
                        // Create new incident
                        await database_1.default.query(`INSERT INTO incidents (
                title,
                description,
                severity,
                status,
                source,
                source_id,
                detected_at,
                affected_assets,
                ioc_indicators
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
                            title,
                            description,
                            severity,
                            'new',
                            'crowdstrike',
                            detection.detection_id,
                            new Date(detection.created_timestamp),
                            affectedAssets,
                            JSON.stringify({
                                hostname: detection.device?.hostname,
                                ip: detection.device?.local_ip,
                                tactics: detection.behaviors.map(b => b.tactic),
                                techniques: detection.behaviors.map(b => b.technique)
                            })
                        ]);
                        result.itemsCreated++;
                    }
                }
                catch (error) {
                    result.errors.push(`Failed to process detection ${detection.detection_id}: ${error.message}`);
                    logger_1.default.error('Error processing CrowdStrike detection', { detection, error: error.message });
                }
            }
            // Update connector status
            await database_1.default.query(`UPDATE connector_configs 
        SET last_sync = NOW(), status = 'active'
        WHERE id = $1`, [this.config.id]);
        }
        catch (error) {
            result.success = false;
            result.errors.push(`CrowdStrike sync failed: ${error.message}`);
            logger_1.default.error('CrowdStrike incident sync failed', { error: error.message });
            await database_1.default.query(`UPDATE connector_configs 
        SET status = 'error', last_error = $1
        WHERE id = $2`, [error.message, this.config.id]);
        }
        result.duration = Date.now() - startTime;
        logger_1.default.info('CrowdStrike incident sync completed', result);
        return result;
    }
    async syncAssets() {
        const startTime = Date.now();
        const result = {
            success: true,
            itemsProcessed: 0,
            itemsCreated: 0,
            itemsUpdated: 0,
            errors: [],
            duration: 0
        };
        try {
            // Get all device IDs
            const idsResponse = await this.client.get('/devices/queries/devices/v1', {
                params: { limit: 5000 }
            });
            const deviceIds = idsResponse.data.resources || [];
            if (deviceIds.length === 0) {
                result.duration = Date.now() - startTime;
                return result;
            }
            // Get device details in batches of 100
            const batchSize = 100;
            for (let i = 0; i < deviceIds.length; i += batchSize) {
                const batch = deviceIds.slice(i, i + batchSize);
                const detailsResponse = await this.client.post('/devices/entities/devices/v1', {
                    ids: batch
                });
                const devices = detailsResponse.data.resources || [];
                result.itemsProcessed += devices.length;
                for (const device of devices) {
                    try {
                        const existingAsset = await database_1.default.query('SELECT id FROM assets WHERE hostname = $1 OR ip_address = $2', [device.hostname, device.local_ip]);
                        if (existingAsset.rows.length > 0) {
                            // Update existing asset
                            await database_1.default.query(`UPDATE assets 
                SET 
                  edr_installed = true,
                  os = $1,
                  last_scan = NOW(),
                  updated_at = NOW()
                WHERE id = $2`, [device.os_version, existingAsset.rows[0].id]);
                            result.itemsUpdated++;
                        }
                        else {
                            // Create new asset
                            await database_1.default.query(`INSERT INTO assets (
                  name,
                  type,
                  hostname,
                  ip_address,
                  os,
                  edr_installed,
                  last_scan
                ) VALUES ($1, $2, $3, $4, $5, true, NOW())`, [
                                device.hostname,
                                device.platform_name === 'Windows' ? 'workstation' : 'server',
                                device.hostname,
                                device.local_ip,
                                device.os_version
                            ]);
                            result.itemsCreated++;
                        }
                    }
                    catch (error) {
                        result.errors.push(`Failed to process device ${device.hostname}: ${error.message}`);
                        logger_1.default.error('Error processing CrowdStrike device', { device, error: error.message });
                    }
                }
            }
        }
        catch (error) {
            result.success = false;
            result.errors.push(`CrowdStrike asset sync failed: ${error.message}`);
            logger_1.default.error('CrowdStrike asset sync failed', { error: error.message });
        }
        result.duration = Date.now() - startTime;
        logger_1.default.info('CrowdStrike asset sync completed', result);
        return result;
    }
}
exports.CrowdStrikeConnector = CrowdStrikeConnector;
//# sourceMappingURL=crowdstrike.connector.js.map