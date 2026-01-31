"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_service_1 = require("../services/auth.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)();
// Rate limiting for login
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts. Please try again later.',
});
// Register
router.post('/register', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain uppercase, lowercase, number and special character'),
    (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('role')
        .isIn(['ceo', 'ciso', 'soc_analyst', 'auditor', 'admin'])
        .withMessage('Invalid role'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { email, password, name, role, department } = req.body;
        const user = await auth_service_1.authService.register({
            email,
            password,
            fullName: name,
            role,
            department,
        });
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Registration failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Login
router.post('/login', loginLimiter, [
    (0, express_validator_1.body)('username').trim().notEmpty().withMessage('Username is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { username, password } = req.body;
        const ipAddress = req.ip;
        const result = await auth_service_1.authService.login(username, password, ipAddress);
        if (!result) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid username or password',
            });
        }
        res.json({
            success: true,
            user: {
                id: result.user.id,
                username: result.user.username,
                email: result.user.email,
                fullName: result.user.fullName,
                role: result.user.role,
                department: result.user.department,
            },
            tokens: result.tokens,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }
        const tokens = await auth_service_1.authService.refreshToken(refreshToken);
        if (!tokens) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        res.json({ success: true, tokens });
    }
    catch (error) {
        res.status(500).json({ error: 'Token refresh failed' });
    }
});
// Get current user
router.get('/me', auth_middleware_1.authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const user = await auth_service_1.authService.getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                department: user.department,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});
// Logout
router.post('/logout', auth_middleware_1.authenticate, async (req, res) => {
    try {
        if (req.user) {
            await auth_service_1.authService.logout(req.user.userId);
        }
        res.json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map