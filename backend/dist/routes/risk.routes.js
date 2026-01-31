"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const risk_service_1 = require("../services/risk.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Get all risks
router.get('/', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'auditor', 'admin'), async (req, res) => {
    try {
        const status = req.query.status;
        const priority = req.query.priority;
        const risks = await risk_service_1.riskService.getRisks({ status, priority });
        res.json({ success: true, data: risks });
    }
    catch (error) {
        console.error('Error fetching risks:', error);
        res.status(500).json({ error: 'Failed to fetch risks' });
    }
});
// Get risk by ID
router.get('/:id', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'auditor', 'admin'), async (req, res) => {
    try {
        const risk = await risk_service_1.riskService.getRiskById(req.params.id);
        if (!risk) {
            return res.status(404).json({ error: 'Risk not found' });
        }
        res.json({ success: true, data: risk });
    }
    catch (error) {
        console.error('Error fetching risk:', error);
        res.status(500).json({ error: 'Failed to fetch risk' });
    }
});
// Create new risk
router.post('/', (0, auth_middleware_1.authorize)('ciso', 'admin'), async (req, res) => {
    try {
        const risk = await risk_service_1.riskService.createRisk(req.body, req.user.userId);
        res.status(201).json({ success: true, data: risk });
    }
    catch (error) {
        console.error('Error creating risk:', error);
        res.status(500).json({ error: 'Failed to create risk' });
    }
});
// Update risk
router.patch('/:id', (0, auth_middleware_1.authorize)('ciso', 'admin'), async (req, res) => {
    try {
        const risk = await risk_service_1.riskService.updateRisk(req.params.id, req.body);
        res.json({ success: true, data: risk });
    }
    catch (error) {
        console.error('Error updating risk:', error);
        res.status(500).json({ error: 'Failed to update risk' });
    }
});
// Delete risk
router.delete('/:id', (0, auth_middleware_1.authorize)('admin'), async (req, res) => {
    try {
        await risk_service_1.riskService.deleteRisk(req.params.id);
        res.json({ success: true, message: 'Risk deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting risk:', error);
        res.status(500).json({ error: 'Failed to delete risk' });
    }
});
exports.default = router;
//# sourceMappingURL=risk.routes.js.map