"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const soc_service_1 = require("../services/soc.service");
const router = (0, express_1.Router)();
// All SOC routes require authentication
router.use(auth_middleware_1.authenticate);
// Get current SOC metrics
router.get('/metrics', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'admin'), async (req, res) => {
    try {
        const metrics = await soc_service_1.socService.getCurrentMetrics();
        res.json({ success: true, data: metrics });
    }
    catch (error) {
        console.error('Error fetching SOC metrics:', error);
        res.status(500).json({ error: 'Failed to fetch SOC metrics' });
    }
});
// Get metrics history
router.get('/metrics/history', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'admin'), async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const history = await soc_service_1.socService.getMetricsHistory(days);
        res.json({ success: true, data: history });
    }
    catch (error) {
        console.error('Error fetching metrics history:', error);
        res.status(500).json({ error: 'Failed to fetch metrics history' });
    }
});
// Get incidents list
router.get('/incidents', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'admin'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const status = req.query.status;
        const severity = req.query.severity;
        const incidents = await soc_service_1.socService.getIncidents({ limit, offset, status, severity });
        res.json({ success: true, data: incidents });
    }
    catch (error) {
        console.error('Error fetching incidents:', error);
        res.status(500).json({ error: 'Failed to fetch incidents' });
    }
});
// Get incident by ID
router.get('/incidents/:id', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'admin'), async (req, res) => {
    try {
        const incident = await soc_service_1.socService.getIncidentById(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }
        res.json({ success: true, data: incident });
    }
    catch (error) {
        console.error('Error fetching incident:', error);
        res.status(500).json({ error: 'Failed to fetch incident' });
    }
});
// Update incident
router.patch('/incidents/:id', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'admin'), async (req, res) => {
    try {
        const updated = await soc_service_1.socService.updateIncident(req.params.id, req.body);
        res.json({ success: true, data: updated });
    }
    catch (error) {
        console.error('Error updating incident:', error);
        res.status(500).json({ error: 'Failed to update incident' });
    }
});
// Get recent events
router.get('/events', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'admin'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const events = await soc_service_1.socService.getRecentEvents(limit);
        res.json({ success: true, data: events });
    }
    catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});
// Get analyst performance
router.get('/analysts/performance', (0, auth_middleware_1.authorize)('ciso', 'admin'), async (req, res) => {
    try {
        const performance = await soc_service_1.socService.getAnalystPerformance();
        res.json({ success: true, data: performance });
    }
    catch (error) {
        console.error('Error fetching analyst performance:', error);
        res.status(500).json({ error: 'Failed to fetch analyst performance' });
    }
});
// Get active tasks
router.get('/tasks', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'admin'), async (req, res) => {
    try {
        const incidentId = req.query.incidentId;
        const tasks = await soc_service_1.socService.getTasks(incidentId);
        res.json({ success: true, data: tasks });
    }
    catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});
exports.default = router;
//# sourceMappingURL=soc.routes.js.map