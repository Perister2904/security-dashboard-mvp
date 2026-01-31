"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupWorker = exports.metricsWorker = exports.assetSyncWorker = exports.incidentSyncWorker = exports.metricsQueue = exports.syncQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const connectors_1 = require("../connectors");
const database_1 = __importDefault(require("../config/database"));
const redis_1 = require("../config/redis");
const logger_1 = __importDefault(require("../utils/logger"));
const connection = new ioredis_1.default({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null
});
// Create job queues
exports.syncQueue = new bullmq_1.Queue('sync', { connection });
exports.metricsQueue = new bullmq_1.Queue('metrics', { connection });
/**
 * Incident Sync Worker
 * Syncs incidents from all enabled connectors
 */
const incidentSyncWorker = new bullmq_1.Worker('sync', async (job) => {
    if (job.name === 'sync-incidents') {
        logger_1.default.info('Starting incident sync job');
        try {
            const since = job.data.since ? new Date(job.data.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
            const results = await connectors_1.connectorManager.syncAllIncidents(since);
            // Invalidate SOC cache
            await (0, redis_1.cacheInvalidatePattern)('soc:*');
            logger_1.default.info('Incident sync job completed', { results });
            return results;
        }
        catch (error) {
            logger_1.default.error('Incident sync job failed', { error: error.message });
            throw error;
        }
    }
}, { connection });
exports.incidentSyncWorker = incidentSyncWorker;
/**
 * Asset Sync Worker
 * Syncs assets from all enabled connectors
 */
const assetSyncWorker = new bullmq_1.Worker('sync', async (job) => {
    if (job.name === 'sync-assets') {
        logger_1.default.info('Starting asset sync job');
        try {
            const results = await connectors_1.connectorManager.syncAllAssets();
            // Invalidate asset cache
            await (0, redis_1.cacheInvalidatePattern)('asset:*');
            await (0, redis_1.cacheInvalidatePattern)('assets:*');
            logger_1.default.info('Asset sync job completed', { results });
            return results;
        }
        catch (error) {
            logger_1.default.error('Asset sync job failed', { error: error.message });
            throw error;
        }
    }
}, { connection });
exports.assetSyncWorker = assetSyncWorker;
/**
 * Metrics Calculation Worker
 * Calculates and stores metrics history
 */
const metricsWorker = new bullmq_1.Worker('metrics', async (job) => {
    if (job.name === 'calculate-metrics') {
        logger_1.default.info('Starting metrics calculation job');
        try {
            // Calculate SOC metrics
            const socMetrics = await database_1.default.query(`
          SELECT 
            COUNT(*) FILTER (WHERE status != 'resolved' AND status != 'closed') as active_incidents,
            COUNT(*) FILTER (WHERE severity = 'critical' AND status != 'resolved') as critical_incidents,
            ROUND(AVG(mttr) FILTER (WHERE resolved_at IS NOT NULL), 2) as avg_mttr,
            ROUND(AVG(mtd) FILTER (WHERE detected_at IS NOT NULL), 2) as avg_mtd,
            ROUND(AVG(mtr) FILTER (WHERE responded_at IS NOT NULL), 2) as avg_mtr,
            ROUND(AVG(mtc) FILTER (WHERE contained_at IS NOT NULL), 2) as avg_mtc,
            COUNT(*) FILTER (WHERE detected_at >= NOW() - INTERVAL '24 hours') as alert_volume,
            COUNT(*) FILTER (WHERE false_positive = true)::float / NULLIF(COUNT(*), 0) * 100 as false_positive_rate
          FROM incidents
          WHERE detected_at >= NOW() - INTERVAL '30 days'
        `);
            const metrics = socMetrics.rows[0];
            // Store metrics in history
            const metricNames = ['mttr', 'mtd', 'mtr', 'mtc', 'alert_volume', 'false_positive_rate'];
            for (const metricName of metricNames) {
                const value = metrics[`avg_${metricName}`] || metrics[metricName];
                if (value !== null && value !== undefined) {
                    await database_1.default.query(`INSERT INTO metrics_history (metric_date, metric_name, metric_value)
              VALUES (NOW(), $1, $2)`, [metricName, value]);
                }
            }
            // Calculate department-specific metrics
            const deptMetrics = await database_1.default.query(`
          SELECT 
            a.department,
            COUNT(DISTINCT i.id) as incident_count,
            ROUND(AVG(i.mttr), 2) as avg_mttr
          FROM incidents i
          JOIN LATERAL unnest(i.affected_assets) asset_id ON true
          JOIN assets a ON a.id = asset_id
          WHERE i.detected_at >= NOW() - INTERVAL '24 hours'
          GROUP BY a.department
        `);
            for (const dept of deptMetrics.rows) {
                await database_1.default.query(`INSERT INTO metrics_history (metric_date, metric_name, metric_value, department)
            VALUES (NOW(), $1, $2, $3)`, ['department_incidents', dept.incident_count, dept.department]);
            }
            // Invalidate cache
            await (0, redis_1.cacheInvalidatePattern)('soc:metrics:*');
            await (0, redis_1.cacheInvalidatePattern)('ceo:*');
            logger_1.default.info('Metrics calculation job completed');
            return { success: true, metricsCalculated: metricNames.length };
        }
        catch (error) {
            logger_1.default.error('Metrics calculation job failed', { error: error.message });
            throw error;
        }
    }
}, { connection });
exports.metricsWorker = metricsWorker;
/**
 * Data Cleanup Worker
 * Removes old data based on retention policies
 */
const cleanupWorker = new bullmq_1.Worker('metrics', async (job) => {
    if (job.name === 'cleanup-old-data') {
        logger_1.default.info('Starting data cleanup job');
        try {
            const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '365');
            // Delete old resolved incidents
            const incidentsResult = await database_1.default.query(`DELETE FROM incidents 
          WHERE resolved_at < NOW() - INTERVAL '1 day' * $1 
          AND status IN ('resolved', 'closed')
          RETURNING id`, [retentionDays]);
            // Delete old metrics history
            const metricsResult = await database_1.default.query(`DELETE FROM metrics_history 
          WHERE metric_date < NOW() - INTERVAL '1 day' * $1
          RETURNING id`, [retentionDays]);
            // Delete old audit logs
            const auditResult = await database_1.default.query(`DELETE FROM audit_logs 
          WHERE created_at < NOW() - INTERVAL '1 day' * $1
          RETURNING id`, [retentionDays]);
            // Delete old sync logs
            const syncResult = await database_1.default.query(`DELETE FROM sync_logs 
          WHERE sync_time < NOW() - INTERVAL '90 days'
          RETURNING id`, []);
            logger_1.default.info('Data cleanup job completed', {
                incidentsDeleted: incidentsResult.rowCount,
                metricsDeleted: metricsResult.rowCount,
                auditLogsDeleted: auditResult.rowCount,
                syncLogsDeleted: syncResult.rowCount
            });
            return {
                success: true,
                incidentsDeleted: incidentsResult.rowCount,
                metricsDeleted: metricsResult.rowCount,
                auditLogsDeleted: auditResult.rowCount,
                syncLogsDeleted: syncResult.rowCount
            };
        }
        catch (error) {
            logger_1.default.error('Data cleanup job failed', { error: error.message });
            throw error;
        }
    }
}, { connection });
exports.cleanupWorker = cleanupWorker;
// Event handlers
incidentSyncWorker.on('completed', (job) => {
    logger_1.default.info(`Incident sync job ${job.id} completed`);
});
incidentSyncWorker.on('failed', (job, err) => {
    logger_1.default.error(`Incident sync job ${job?.id} failed`, { error: err.message });
});
assetSyncWorker.on('completed', (job) => {
    logger_1.default.info(`Asset sync job ${job.id} completed`);
});
assetSyncWorker.on('failed', (job, err) => {
    logger_1.default.error(`Asset sync job ${job?.id} failed`, { error: err.message });
});
metricsWorker.on('completed', (job) => {
    logger_1.default.info(`Metrics job ${job.id} completed`);
});
metricsWorker.on('failed', (job, err) => {
    logger_1.default.error(`Metrics job ${job?.id} failed`, { error: err.message });
});
cleanupWorker.on('completed', (job) => {
    logger_1.default.info(`Cleanup job ${job.id} completed`);
});
cleanupWorker.on('failed', (job, err) => {
    logger_1.default.error(`Cleanup job ${job?.id} failed`, { error: err.message });
});
logger_1.default.info('Background workers initialized');
//# sourceMappingURL=sync.worker.js.map