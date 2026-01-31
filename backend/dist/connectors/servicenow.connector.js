"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowConnector = void 0;
const base_connector_1 = require("./base.connector");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
class ServiceNowConnector extends base_connector_1.BaseConnector {
    constructor(config) {
        super(config);
    }
    async testConnection() {
        try {
            const response = await this.client.get('/api/now/table/sys_user', {
                params: { sysparm_limit: 1 }
            });
            return response.status === 200;
        }
        catch (error) {
            logger_1.default.error('ServiceNow connection test failed', { error: error.message });
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
            const sinceDate = since
                ? since.toISOString().split('T')[0] + ' 00:00:00'
                : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
            // Query ServiceNow incidents table
            const response = await this.client.get('/api/now/table/incident', {
                params: {
                    sysparm_query: `opened_at>=${sinceDate}^category=security^ORcategory=network^priority<=3`,
                    sysparm_limit: 1000,
                    sysparm_fields: 'sys_id,number,short_description,description,priority,urgency,severity,state,assigned_to,opened_at,resolved_at,cmdb_ci'
                }
            });
            const incidents = response.data.result || [];
            result.itemsProcessed = incidents.length;
            for (const incident of incidents) {
                try {
                    // Check if incident already exists
                    const existingIncident = await database_1.default.query('SELECT id FROM incidents WHERE source_id = $1 AND source = $2', [incident.sys_id, 'servicenow']);
                    // Map ServiceNow priority (1-5) to severity
                    let severity;
                    const priority = parseInt(incident.priority);
                    if (priority === 1)
                        severity = 'critical';
                    else if (priority === 2)
                        severity = 'high';
                    else if (priority === 3)
                        severity = 'medium';
                    else
                        severity = 'low';
                    // Map ServiceNow state to our status
                    let status;
                    const state = parseInt(incident.state);
                    if (state === 1)
                        status = 'new';
                    else if (state >= 2 && state <= 5)
                        status = 'in-progress';
                    else if (state === 6)
                        status = 'resolved';
                    else
                        status = 'closed';
                    // Find affected assets
                    const affectedAssets = [];
                    if (incident.cmdb_ci?.display_value) {
                        const asset = await database_1.default.query('SELECT id FROM assets WHERE name = $1 OR hostname = $1', [incident.cmdb_ci.display_value]);
                        if (asset.rows.length > 0) {
                            affectedAssets.push(asset.rows[0].id);
                        }
                    }
                    if (existingIncident.rows.length > 0) {
                        // Update existing incident
                        await database_1.default.query(`UPDATE incidents 
              SET 
                status = $1,
                resolved_at = $2,
                updated_at = NOW()
              WHERE id = $3`, [
                            status,
                            incident.resolved_at ? new Date(incident.resolved_at) : null,
                            existingIncident.rows[0].id
                        ]);
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
                resolved_at,
                affected_assets
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
                            incident.short_description || `ServiceNow Incident ${incident.number}`,
                            incident.description || '',
                            severity,
                            status,
                            'servicenow',
                            incident.sys_id,
                            new Date(incident.opened_at),
                            incident.resolved_at ? new Date(incident.resolved_at) : null,
                            affectedAssets
                        ]);
                        result.itemsCreated++;
                    }
                }
                catch (error) {
                    result.errors.push(`Failed to process incident ${incident.number}: ${error.message}`);
                    logger_1.default.error('Error processing ServiceNow incident', { incident, error: error.message });
                }
            }
            // Update connector status
            await database_1.default.query(`UPDATE connector_configs 
        SET last_sync = NOW(), status = 'active'
        WHERE id = $1`, [this.config.id]);
        }
        catch (error) {
            result.success = false;
            result.errors.push(`ServiceNow sync failed: ${error.message}`);
            logger_1.default.error('ServiceNow incident sync failed', { error: error.message });
            await database_1.default.query(`UPDATE connector_configs 
        SET status = 'error', last_error = $1
        WHERE id = $2`, [error.message, this.config.id]);
        }
        result.duration = Date.now() - startTime;
        logger_1.default.info('ServiceNow incident sync completed', result);
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
            // Query ServiceNow CMDB (Configuration Items)
            const response = await this.client.get('/api/now/table/cmdb_ci_server', {
                params: {
                    sysparm_query: 'install_status=1^ORinstall_status=3', // Installed or In Maintenance
                    sysparm_limit: 5000,
                    sysparm_fields: 'sys_id,name,ip_address,dns_domain,os,classification,u_criticality,u_department,install_status'
                }
            });
            const cis = response.data.result || [];
            result.itemsProcessed = cis.length;
            for (const ci of cis) {
                try {
                    // Map ServiceNow criticality to our format
                    let criticality = 'medium';
                    if (ci.u_criticality) {
                        const crit = ci.u_criticality.toLowerCase();
                        if (['critical', '1', 'tier 1'].includes(crit))
                            criticality = 'critical';
                        else if (['high', '2', 'tier 2'].includes(crit))
                            criticality = 'high';
                        else if (['low', '4', 'tier 4'].includes(crit))
                            criticality = 'low';
                    }
                    const existingAsset = await database_1.default.query('SELECT id FROM assets WHERE name = $1 OR hostname = $2 OR ip_address = $3', [ci.name, ci.name, ci.ip_address]);
                    if (existingAsset.rows.length > 0) {
                        // Update existing asset
                        await database_1.default.query(`UPDATE assets 
              SET 
                criticality = $1,
                department = $2,
                os = $3,
                last_scan = NOW(),
                updated_at = NOW()
              WHERE id = $4`, [
                            criticality,
                            ci.u_department || 'Unknown',
                            ci.os || 'Unknown',
                            existingAsset.rows[0].id
                        ]);
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
                department,
                criticality,
                last_scan
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`, [
                            ci.name,
                            ci.classification || 'server',
                            ci.name,
                            ci.ip_address || '',
                            ci.os || 'Unknown',
                            ci.u_department || 'Unknown',
                            criticality
                        ]);
                        result.itemsCreated++;
                    }
                }
                catch (error) {
                    result.errors.push(`Failed to process CI ${ci.name}: ${error.message}`);
                    logger_1.default.error('Error processing ServiceNow CI', { ci, error: error.message });
                }
            }
        }
        catch (error) {
            result.success = false;
            result.errors.push(`ServiceNow asset sync failed: ${error.message}`);
            logger_1.default.error('ServiceNow asset sync failed', { error: error.message });
        }
        result.duration = Date.now() - startTime;
        logger_1.default.info('ServiceNow asset sync completed', result);
        return result;
    }
}
exports.ServiceNowConnector = ServiceNowConnector;
//# sourceMappingURL=servicenow.connector.js.map