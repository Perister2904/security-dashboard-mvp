import { Worker, Queue } from 'bullmq';
export declare const syncQueue: Queue<any, any, string, any, any, string>;
export declare const metricsQueue: Queue<any, any, string, any, any, string>;
/**
 * Incident Sync Worker
 * Syncs incidents from all enabled connectors
 */
declare const incidentSyncWorker: Worker<any, any, string>;
/**
 * Asset Sync Worker
 * Syncs assets from all enabled connectors
 */
declare const assetSyncWorker: Worker<any, any, string>;
/**
 * Metrics Calculation Worker
 * Calculates and stores metrics history
 */
declare const metricsWorker: Worker<any, any, string>;
/**
 * Data Cleanup Worker
 * Removes old data based on retention policies
 */
declare const cleanupWorker: Worker<any, any, string>;
export { incidentSyncWorker, assetSyncWorker, metricsWorker, cleanupWorker };
//# sourceMappingURL=sync.worker.d.ts.map