"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ceo_service_1 = require("../services/ceo.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Get executive summary
router.get('/summary', (0, auth_middleware_1.authorize)('ceo', 'ciso', 'admin'), async (req, res) => {
    try {
        const summary = await ceo_service_1.ceoService.getExecutiveSummary();
        res.json({ success: true, data: summary });
    }
    catch (error) {
        console.error('Error fetching CEO summary:', error);
        res.status(500).json({ error: 'Failed to fetch executive summary' });
    }
});
// Get financial impact analysis
router.get('/financial-impact', (0, auth_middleware_1.authorize)('ceo', 'ciso', 'admin'), async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const impact = await ceo_service_1.ceoService.getFinancialImpact(days);
        res.json({ success: true, data: impact });
    }
    catch (error) {
        console.error('Error fetching financial impact:', error);
        res.status(500).json({ error: 'Failed to fetch financial impact' });
    }
});
// Get top risks by business impact
router.get('/top-risks', (0, auth_middleware_1.authorize)('ceo', 'ciso', 'admin'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const risks = await ceo_service_1.ceoService.getTopRisks(limit);
        res.json({ success: true, data: risks });
    }
    catch (error) {
        console.error('Error fetching top risks:', error);
        res.status(500).json({ error: 'Failed to fetch top risks' });
    }
});
// Get compliance posture
router.get('/compliance', (0, auth_middleware_1.authorize)('ceo', 'ciso', 'auditor', 'admin'), async (req, res) => {
    try {
        const compliance = await ceo_service_1.ceoService.getCompliancePosture();
        res.json({ success: true, data: compliance });
    }
    catch (error) {
        console.error('Error fetching compliance posture:', error);
        res.status(500).json({ error: 'Failed to fetch compliance posture' });
    }
});
// Request executive report via email
router.post('/email-report', (0, auth_middleware_1.authorize)('ceo', 'ciso', 'admin'), async (req, res) => {
    try {
        const { email, reportType } = req.body;
        await ceo_service_1.ceoService.sendExecutiveReport(email, reportType);
        res.json({ success: true, message: 'Report sent successfully' });
    }
    catch (error) {
        console.error('Error sending report:', error);
        res.status(500).json({ error: 'Failed to send report' });
    }
});
exports.default = router;
//# sourceMappingURL=ceo.routes.js.map