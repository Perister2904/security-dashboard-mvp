import { Router, Response, Request } from 'express';
import { adSyncService } from '../services/ad-sync.service';
import logger from '../utils/logger';

const router = Router();

/**
 * Trigger Active Directory sync (PUBLIC - no auth for demo)
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    logger.info('AD sync triggered via API');
    const result = await adSyncService.syncFromAD();
    
    res.json({
      success: result.success,
      message: `Synced ${result.assetsImported} assets from Active Directory`,
      data: {
        assetsImported: result.assetsImported,
        errors: result.errors
      }
    });
  } catch (error: any) {
    logger.error('AD sync API error:', error);
    res.status(500).json({
      success: false,
      error: 'AD sync failed',
      message: error.message
    });
  }
});

/**
 * Get sync statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await adSyncService.getSyncStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Failed to get sync stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync stats'
    });
  }
});

export default router;
