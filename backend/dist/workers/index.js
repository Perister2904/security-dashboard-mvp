"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkers = startWorkers;
exports.stopWorkers = stopWorkers;
const node_cron_1 = __importDefault(require("node-cron"));
const sync_worker_1 = require("./sync.worker");
const connectors_1 = require("../connectors");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Worker Entry Point
 * Schedules and manages background jobs
 */
async function startWorkers() {
    logger_1.default.info('Starting background workers...');
    try {
        // Initialize connectors
        await connectors_1.connectorManager.initialize();
        logger_1.default.info('Connectors initialized');
        // Schedule incident sync (every 5 minutes)
        const incidentSyncInterval = process.env.INCIDENT_SYNC_INTERVAL || '*/5 * * * *';
        node_cron_1.default.schedule(incidentSyncInterval, async () => {
            logger_1.default.info('Triggering incident sync job');
            await sync_worker_1.syncQueue.add('sync-incidents', {
                since: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
            });
        });
        logger_1.default.info(`Incident sync scheduled: ${incidentSyncInterval}`);
        // Schedule asset sync (every 1 hour)
        const assetSyncInterval = process.env.ASSET_SYNC_INTERVAL || '0 * * * *';
        node_cron_1.default.schedule(assetSyncInterval, async () => {
            logger_1.default.info('Triggering asset sync job');
            await sync_worker_1.syncQueue.add('sync-assets', {});
        });
        logger_1.default.info(`Asset sync scheduled: ${assetSyncInterval}`);
        // Schedule metrics calculation (every 5 minutes)
        const metricsInterval = process.env.METRICS_CALC_INTERVAL || '*/5 * * * *';
        node_cron_1.default.schedule(metricsInterval, async () => {
            logger_1.default.info('Triggering metrics calculation job');
            await sync_worker_1.metricsQueue.add('calculate-metrics', {});
        });
        logger_1.default.info(`Metrics calculation scheduled: ${metricsInterval}`);
        // Schedule data cleanup (daily at 2 AM)
        const cleanupInterval = process.env.CLEANUP_INTERVAL || '0 2 * * *';
        node_cron_1.default.schedule(cleanupInterval, async () => {
            logger_1.default.info('Triggering data cleanup job');
            await sync_worker_1.metricsQueue.add('cleanup-old-data', {});
        });
        logger_1.default.info(`Data cleanup scheduled: ${cleanupInterval}`);
        // Run initial sync on startup
        logger_1.default.info('Running initial data sync...');
        await sync_worker_1.syncQueue.add('sync-incidents', {
            since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        });
        await sync_worker_1.syncQueue.add('sync-assets', {});
        await sync_worker_1.metricsQueue.add('calculate-metrics', {});
        logger_1.default.info('Background workers started successfully');
    }
    catch (error) {
        logger_1.default.error('Failed to start background workers', { error: error.message });
        throw error;
    }
}
/**
 * Graceful shutdown
 */
async function stopWorkers() {
    logger_1.default.info('Stopping background workers...');
    try {
        await sync_worker_1.syncQueue.close();
        await sync_worker_1.metricsQueue.close();
        logger_1.default.info('Background workers stopped');
    }
    catch (error) {
        logger_1.default.error('Error stopping workers', { error: error.message });
    }
}
// Handle process termination
process.on('SIGTERM', async () => {
    logger_1.default.info('SIGTERM received, shutting down workers...');
    await stopWorkers();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.default.info('SIGINT received, shutting down workers...');
    await stopWorkers();
    process.exit(0);
});
// Start workers if this file is run directly
if (require.main === module) {
    startWorkers().catch((error) => {
        logger_1.default.error('Failed to start workers', { error: error.message });
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map