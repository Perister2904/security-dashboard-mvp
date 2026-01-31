"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const auth_service_1 = require("../services/auth.service");
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
            return;
        }
        const token = authHeader.substring(7);
        const payload = await auth_service_1.authService.verifyToken(token);
        if (!payload) {
            res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
            return;
        }
        req.user = payload;
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication failed' });
    }
}
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
            return;
        }
        if (!auth_service_1.authService.hasRole(req.user.role, allowedRoles)) {
            res.status(403).json({
                error: 'Forbidden',
                message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.middleware.js.map