import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { socService } from '../services/soc.service';

const router = Router();

// All SOC routes require authentication
router.use(authenticate);

// Get current SOC metrics
router.get('/metrics', authorize('soc_analyst', 'ciso', 'ceo', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const metrics = await socService.getCurrentMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error fetching SOC metrics:', error);
    res.status(500).json({ error: 'Failed to fetch SOC metrics' });
  }
});

// Get metrics history
router.get('/metrics/history', authorize('soc_analyst', 'ciso', 'ceo', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const history = await socService.getMetricsHistory(days);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching metrics history:', error);
    res.status(500).json({ error: 'Failed to fetch metrics history' });
  }
});

// Get incidents list
router.get('/incidents', authorize('soc_analyst', 'ciso', 'ceo', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const severity = req.query.severity as string;

    const incidents = await socService.getIncidents({ limit, offset, status, severity });
    res.json({ success: true, data: incidents });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Get incident by ID
router.get('/incidents/:id', authorize('soc_analyst', 'ciso', 'ceo', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const incident = await socService.getIncidentById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json({ success: true, data: incident });
  } catch (error) {
    console.error('Error fetching incident:', error);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// Update incident
router.patch('/incidents/:id', authorize('soc_analyst', 'ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const updated = await socService.updateIncident(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// Get recent events
router.get('/events', authorize('soc_analyst', 'ciso', 'ceo', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await socService.getRecentEvents(limit);
    res.json({ success: true, data: events });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get analyst performance
router.get('/analysts/performance', authorize('ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const performance = await socService.getAnalystPerformance();
    res.json({ success: true, data: performance });
  } catch (error) {
    console.error('Error fetching analyst performance:', error);
    res.status(500).json({ error: 'Failed to fetch analyst performance' });
  }
});

// Get active tasks
router.get('/tasks', authorize('soc_analyst', 'ciso', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const incidentId = req.query.incidentId as string | undefined;
    const tasks = await socService.getTasks(incidentId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

export default router;
