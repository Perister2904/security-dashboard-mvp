"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const asset_service_1 = require("../services/asset.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Get all assets
router.get('/', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'auditor', 'admin'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const department = req.query.department;
        const criticality = req.query.criticality;
        const assets = await asset_service_1.assetService.getAssets({ limit, offset, department, criticality });
        res.json({ success: true, data: assets });
    }
    catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});
// Get asset by ID
router.get('/:id', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'auditor', 'admin'), async (req, res) => {
    try {
        const asset = await asset_service_1.assetService.getAssetById(req.params.id);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.json({ success: true, data: asset });
    }
    catch (error) {
        console.error('Error fetching asset:', error);
        res.status(500).json({ error: 'Failed to fetch asset' });
    }
});
// Get coverage statistics
router.get('/stats/coverage', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'admin'), async (req, res) => {
    try {
        const coverage = await asset_service_1.assetService.getCoverageStats();
        res.json({ success: true, data: coverage });
    }
    catch (error) {
        console.error('Error fetching coverage stats:', error);
        res.status(500).json({ error: 'Failed to fetch coverage stats' });
    }
});
// Get risk posture
router.get('/stats/risk-posture', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'ceo', 'admin'), async (req, res) => {
    try {
        const posture = await asset_service_1.assetService.getRiskPosture();
        res.json({ success: true, data: posture });
    }
    catch (error) {
        console.error('Error fetching risk posture:', error);
        res.status(500).json({ error: 'Failed to fetch risk posture' });
    }
});
// Get coverage gaps
router.get('/stats/gaps', (0, auth_middleware_1.authorize)('soc_analyst', 'ciso', 'admin'), async (req, res) => {
    try {
        const gaps = await asset_service_1.assetService.getCoverageGaps();
        res.json({ success: true, data: gaps });
    }
    catch (error) {
        console.error('Error fetching coverage gaps:', error);
        res.status(500).json({ error: 'Failed to fetch coverage gaps' });
    }
});
exports.default = router;
//# sourceMappingURL=asset.routes.js.map