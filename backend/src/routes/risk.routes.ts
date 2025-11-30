import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { riskService } from '../services/risk.service';

const router = Router();

router.use(authenticate);

// Get all risks
router.get('/', authorize('soc_analyst', 'ciso', 'ceo', 'auditor', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    
    const risks = await riskService.getRisks({ status, priority });
    res.json({ success: true, data: risks });
  } catch (error) {
    console.error('Error fetching risks:', error);
    res.status(500).json({ error: 'Failed to fetch risks' });
  }
});

// Get risk by ID
router.get('/:id', authorize('soc_analyst', 'ciso', 'ceo', 'auditor', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const risk = await riskService.getRiskById(req.params.id);
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    res.json({ success: true, data: risk });
  } catch (error) {
    console.error('Error fetching risk:', error);
    res.status(500).json({ error: 'Failed to fetch risk' });
  }
});

// Create new risk
router.post('/', authorize('ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const risk = await riskService.createRisk(req.body, req.user!.userId);
    res.status(201).json({ success: true, data: risk });
  } catch (error) {
    console.error('Error creating risk:', error);
    res.status(500).json({ error: 'Failed to create risk' });
  }
});

// Update risk
router.patch('/:id', authorize('ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const risk = await riskService.updateRisk(req.params.id, req.body);
    res.json({ success: true, data: risk });
  } catch (error) {
    console.error('Error updating risk:', error);
    res.status(500).json({ error: 'Failed to update risk' });
  }
});

// Delete risk
router.delete('/:id', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    await riskService.deleteRisk(req.params.id);
    res.json({ success: true, message: 'Risk deleted successfully' });
  } catch (error) {
    console.error('Error deleting risk:', error);
    res.status(500).json({ error: 'Failed to delete risk' });
  }
});

export default router;
