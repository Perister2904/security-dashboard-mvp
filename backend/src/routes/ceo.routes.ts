import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { ceoService } from '../services/ceo.service';

const router = Router();

router.use(authenticate);

// Get executive summary
router.get('/summary', authorize('ceo', 'ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const summary = await ceoService.getExecutiveSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching CEO summary:', error);
    res.status(500).json({ error: 'Failed to fetch executive summary' });
  }
});

// Get financial impact analysis
router.get('/financial-impact', authorize('ceo', 'ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const impact = await ceoService.getFinancialImpact(days);
    res.json({ success: true, data: impact });
  } catch (error) {
    console.error('Error fetching financial impact:', error);
    res.status(500).json({ error: 'Failed to fetch financial impact' });
  }
});

// Get top risks by business impact
router.get('/top-risks', authorize('ceo', 'ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const risks = await ceoService.getTopRisks(limit);
    res.json({ success: true, data: risks });
  } catch (error) {
    console.error('Error fetching top risks:', error);
    res.status(500).json({ error: 'Failed to fetch top risks' });
  }
});

// Get compliance posture
router.get('/compliance', authorize('ceo', 'ciso', 'auditor', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const compliance = await ceoService.getCompliancePosture();
    res.json({ success: true, data: compliance });
  } catch (error) {
    console.error('Error fetching compliance posture:', error);
    res.status(500).json({ error: 'Failed to fetch compliance posture' });
  }
});

// Request executive report via email
router.post('/email-report', authorize('ceo', 'ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, reportType } = req.body;
    await ceoService.sendExecutiveReport(email, reportType);
    res.json({ success: true, message: 'Report sent successfully' });
  } catch (error) {
    console.error('Error sending report:', error);
    res.status(500).json({ error: 'Failed to send report' });
  }
});

export default router;
