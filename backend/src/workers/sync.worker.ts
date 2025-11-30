import { Worker, Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { connectorManager } from '../connectors';
import pool from '../config/database';
import { cacheInvalidatePattern } from '../config/redis';
import logger from '../utils/logger';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null
});

// Create job queues
export const syncQueue = new Queue('sync', { connection });
export const metricsQueue = new Queue('metrics', { connection });

/**
 * Incident Sync Worker
 * Syncs incidents from all enabled connectors
 */
const incidentSyncWorker = new Worker(
  'sync',
  async (job: Job) => {
    if (job.name === 'sync-incidents') {
      logger.info('Starting incident sync job');
      
      try {
        const since = job.data.since ? new Date(job.data.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const results = await connectorManager.syncAllIncidents(since);
        
        // Invalidate SOC cache
        await cacheInvalidatePattern('soc:*');
        
        logger.info('Incident sync job completed', { results });
        return results;
      } catch (error: any) {
        logger.error('Incident sync job failed', { error: error.message });
        throw error;
      }
    }
  },
  { connection }
);

/**
 * Asset Sync Worker
 * Syncs assets from all enabled connectors
 */
const assetSyncWorker = new Worker(
  'sync',
  async (job: Job) => {
    if (job.name === 'sync-assets') {
      logger.info('Starting asset sync job');
      
      try {
        const results = await connectorManager.syncAllAssets();
        
        // Invalidate asset cache
        await cacheInvalidatePattern('asset:*');
        await cacheInvalidatePattern('assets:*');
        
        logger.info('Asset sync job completed', { results });
        return results;
      } catch (error: any) {
        logger.error('Asset sync job failed', { error: error.message });
        throw error;
      }
    }
  },
  { connection }
);

/**
 * Metrics Calculation Worker
 * Calculates and stores metrics history
 */
const metricsWorker = new Worker(
  'metrics',
  async (job: Job) => {
    if (job.name === 'calculate-metrics') {
      logger.info('Starting metrics calculation job');
      
      try {
        // Calculate SOC metrics
        const socMetrics = await pool.query(`
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
            await pool.query(
              `INSERT INTO metrics_history (metric_date, metric_name, metric_value)
              VALUES (NOW(), $1, $2)`,
              [metricName, value]
            );
          }
        }

        // Calculate department-specific metrics
        const deptMetrics = await pool.query(`
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
          await pool.query(
            `INSERT INTO metrics_history (metric_date, metric_name, metric_value, department)
            VALUES (NOW(), $1, $2, $3)`,
            ['department_incidents', dept.incident_count, dept.department]
          );
        }

        // Invalidate cache
        await cacheInvalidatePattern('soc:metrics:*');
        await cacheInvalidatePattern('ceo:*');
        
        logger.info('Metrics calculation job completed');
        return { success: true, metricsCalculated: metricNames.length };
      } catch (error: any) {
        logger.error('Metrics calculation job failed', { error: error.message });
        throw error;
      }
    }
  },
  { connection }
);

/**
 * Data Cleanup Worker
 * Removes old data based on retention policies
 */
const cleanupWorker = new Worker(
  'metrics',
  async (job: Job) => {
    if (job.name === 'cleanup-old-data') {
      logger.info('Starting data cleanup job');
      
      try {
        const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '365');
        
        // Delete old resolved incidents
        const incidentsResult = await pool.query(
          `DELETE FROM incidents 
          WHERE resolved_at < NOW() - INTERVAL '1 day' * $1 
          AND status IN ('resolved', 'closed')
          RETURNING id`,
          [retentionDays]
        );

        // Delete old metrics history
        const metricsResult = await pool.query(
          `DELETE FROM metrics_history 
          WHERE metric_date < NOW() - INTERVAL '1 day' * $1
          RETURNING id`,
          [retentionDays]
        );

        // Delete old audit logs
        const auditResult = await pool.query(
          `DELETE FROM audit_logs 
          WHERE created_at < NOW() - INTERVAL '1 day' * $1
          RETURNING id`,
          [retentionDays]
        );

        // Delete old sync logs
        const syncResult = await pool.query(
          `DELETE FROM sync_logs 
          WHERE sync_time < NOW() - INTERVAL '90 days'
          RETURNING id`,
          []
        );

        logger.info('Data cleanup job completed', {
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
      } catch (error: any) {
        logger.error('Data cleanup job failed', { error: error.message });
        throw error;
      }
    }
  },
  { connection }
);

// Event handlers
incidentSyncWorker.on('completed', (job: Job) => {
  logger.info(`Incident sync job ${job.id} completed`);
});

incidentSyncWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Incident sync job ${job?.id} failed`, { error: err.message });
});

assetSyncWorker.on('completed', (job: Job) => {
  logger.info(`Asset sync job ${job.id} completed`);
});

assetSyncWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Asset sync job ${job?.id} failed`, { error: err.message });
});

metricsWorker.on('completed', (job: Job) => {
  logger.info(`Metrics job ${job.id} completed`);
});

metricsWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Metrics job ${job?.id} failed`, { error: err.message });
});

cleanupWorker.on('completed', (job: Job) => {
  logger.info(`Cleanup job ${job.id} completed`);
});

cleanupWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`Cleanup job ${job?.id} failed`, { error: err.message });
});

logger.info('Background workers initialized');

export { incidentSyncWorker, assetSyncWorker, metricsWorker, cleanupWorker };
