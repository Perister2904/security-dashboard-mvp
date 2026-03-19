import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { assetService } from '../services/asset.service';
import { networkDiscoveryService } from '../services/network-discovery.service';

const router = Router();

router.use(authenticate);

// Run network discovery and compare against AD-authenticated assets
router.get('/discovery/network', authorize('soc_analyst', 'ciso', 'ceo', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const discovery = await networkDiscoveryService.scanNetwork();
    res.json({ success: true, data: discovery });
  } catch (error) {
    console.error('Error running network discovery:', error);
    res.status(500).json({ error: 'Failed to run network discovery' });
  }
});

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

// Backward-compatible aliases
router.get('/coverage', authorize('soc_analyst', 'ciso', 'ceo', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const coverage = await assetService.getCoverageStats();
    res.json({ success: true, data: coverage });
  } catch (error) {
    console.error('Error fetching coverage stats:', error);
    res.status(500).json({ error: 'Failed to fetch coverage stats' });
  }
});

router.get('/compliance', authorize('soc_analyst', 'ciso', 'ceo', 'auditor', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const coverage = await assetService.getCoverageStats();
    res.json({
      success: true,
      data: {
        overallRate: coverage.compliance_pct,
        totalAssets: coverage.total_assets,
        compliantCount: Math.round((coverage.compliance_pct / 100) * coverage.total_assets),
        departmentBreakdown: coverage.departmentBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching compliance stats:', error);
    res.status(500).json({ error: 'Failed to fetch compliance stats' });
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

export default router;
