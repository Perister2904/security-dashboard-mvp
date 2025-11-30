import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { assetService } from '../services/asset.service';

const router = Router();

router.use(authenticate);

// Get all assets
router.get('/', authorize('soc_analyst', 'ciso', 'ceo', 'auditor', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const department = req.query.department as string;
    const criticality = req.query.criticality as string;

    const assets = await assetService.getAssets({ limit, offset, department, criticality });
    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get asset by ID
router.get('/:id', authorize('soc_analyst', 'ciso', 'ceo', 'auditor', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const asset = await assetService.getAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json({ success: true, data: asset });
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Get coverage statistics
router.get('/stats/coverage', authorize('soc_analyst', 'ciso', 'ceo', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const coverage = await assetService.getCoverageStats();
    res.json({ success: true, data: coverage });
  } catch (error) {
    console.error('Error fetching coverage stats:', error);
    res.status(500).json({ error: 'Failed to fetch coverage stats' });
  }
});

// Get risk posture
router.get('/stats/risk-posture', authorize('soc_analyst', 'ciso', 'ceo', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const posture = await assetService.getRiskPosture();
    res.json({ success: true, data: posture });
  } catch (error) {
    console.error('Error fetching risk posture:', error);
    res.status(500).json({ error: 'Failed to fetch risk posture' });
  }
});

// Get coverage gaps
router.get('/stats/gaps', authorize('soc_analyst', 'ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const gaps = await assetService.getCoverageGaps();
    res.json({ success: true, data: gaps });
  } catch (error) {
    console.error('Error fetching coverage gaps:', error);
    res.status(500).json({ error: 'Failed to fetch coverage gaps' });
  }
});

export default router;
