import cron from 'node-cron';
import { syncQueue, metricsQueue } from './sync.worker';
import { connectorManager } from '../connectors';
import logger from '../utils/logger';

/**
 * Worker Entry Point
 * Schedules and manages background jobs
 */
export async function startWorkers(): Promise<void> {
  logger.info('Starting background workers...');

  try {
    // Initialize connectors
    await connectorManager.initialize();
    logger.info('Connectors initialized');

    // Schedule incident sync (every 5 minutes)
    const incidentSyncInterval = process.env.INCIDENT_SYNC_INTERVAL || '*/5 * * * *';
    cron.schedule(incidentSyncInterval, async () => {
      logger.info('Triggering incident sync job');
      await syncQueue.add('sync-incidents', {
        since: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      });
    });
    logger.info(`Incident sync scheduled: ${incidentSyncInterval}`);

    // Schedule asset sync (every 1 hour)
    const assetSyncInterval = process.env.ASSET_SYNC_INTERVAL || '0 * * * *';
    cron.schedule(assetSyncInterval, async () => {
      logger.info('Triggering asset sync job');
      await syncQueue.add('sync-assets', {});
    });
    logger.info(`Asset sync scheduled: ${assetSyncInterval}`);

    // Schedule metrics calculation (every 5 minutes)
    const metricsInterval = process.env.METRICS_CALC_INTERVAL || '*/5 * * * *';
    cron.schedule(metricsInterval, async () => {
      logger.info('Triggering metrics calculation job');
      await metricsQueue.add('calculate-metrics', {});
    });
    logger.info(`Metrics calculation scheduled: ${metricsInterval}`);

    // Schedule data cleanup (daily at 2 AM)
    const cleanupInterval = process.env.CLEANUP_INTERVAL || '0 2 * * *';
    cron.schedule(cleanupInterval, async () => {
      logger.info('Triggering data cleanup job');
      await metricsQueue.add('cleanup-old-data', {});
    });
    logger.info(`Data cleanup scheduled: ${cleanupInterval}`);

    // Run initial sync on startup
    logger.info('Running initial data sync...');
    await syncQueue.add('sync-incidents', {
      since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    });
    await syncQueue.add('sync-assets', {});
    await metricsQueue.add('calculate-metrics', {});

    logger.info('Background workers started successfully');
  } catch (error: any) {
    logger.error('Failed to start background workers', { error: error.message });
    throw error;
  }
}

/**
 * Graceful shutdown
 */
export async function stopWorkers(): Promise<void> {
  logger.info('Stopping background workers...');
  
  try {
    await syncQueue.close();
    await metricsQueue.close();
    logger.info('Background workers stopped');
  } catch (error: any) {
    logger.error('Error stopping workers', { error: error.message });
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down workers...');
  await stopWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down workers...');
  await stopWorkers();
  process.exit(0);
});

// Start workers if this file is run directly
if (require.main === module) {
  startWorkers().catch((error) => {
    logger.error('Failed to start workers', { error: error.message });
    process.exit(1);
  });
}
