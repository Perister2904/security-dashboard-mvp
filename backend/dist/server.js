"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const ldap_service_1 = require("./services/ldap.service");
const logger_1 = __importDefault(require("./utils/logger"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const soc_routes_1 = __importDefault(require("./routes/soc.routes"));
const asset_routes_1 = __importDefault(require("./routes/asset.routes"));
const risk_routes_1 = __importDefault(require("./routes/risk.routes"));
const ceo_routes_1 = __importDefault(require("./routes/ceo.routes"));
const server_1 = __importStar(require("./websocket/server"));
const connectors_1 = require("./connectors");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: process.env.CORS_CREDENTIALS === 'true',
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger_1.default.info({
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
        });
    });
    next();
});
// Health check
app.get('/health', async (req, res) => {
    const dbHealthy = await (0, database_1.testConnection)();
    const redisHealthy = await (0, redis_1.testRedisConnection)();
    const ldapHealthy = await ldap_service_1.ldapService.testConnection();
    const health = {
        status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
            database: dbHealthy ? 'up' : 'down',
            redis: redisHealthy ? 'up' : 'down',
            ldap: ldapHealthy ? 'up' : 'down',
        },
    };
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
// API Routes
const API_BASE = process.env.API_BASE_URL || '/api/v1';
app.use(`${API_BASE}/auth`, auth_routes_1.default);
app.use(`${API_BASE}/soc`, soc_routes_1.default);
app.use(`${API_BASE}/assets`, asset_routes_1.default);
app.use(`${API_BASE}/risks`, risk_routes_1.default);
app.use(`${API_BASE}/ceo`, ceo_routes_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
    });
});
// Error handler
app.use((err, req, res, next) => {
    logger_1.default.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    });
});
// Initialize WebSocket server
let wsManager;
// Start server
async function startServer() {
    try {
        logger_1.default.info('🚀 Starting Security Dashboard Backend...');
        // Test connections
        const dbConnected = await (0, database_1.testConnection)();
        if (!dbConnected) {
            logger_1.default.error('❌ Database connection failed. Exiting...');
            process.exit(1);
        }
        const redisConnected = await (0, redis_1.testRedisConnection)();
        if (!redisConnected) {
            logger_1.default.warn('⚠️  Redis connection failed. Caching will be disabled.');
        }
        const ldapConnected = await ldap_service_1.ldapService.testConnection();
        if (!ldapConnected) {
            logger_1.default.warn('⚠️  LDAP connection failed. AD authentication will be disabled.');
        }
        // Initialize connectors
        try {
            await connectors_1.connectorManager.initialize();
            logger_1.default.info('✅ Security tool connectors initialized');
        }
        catch (error) {
            logger_1.default.warn('⚠️  Failed to initialize connectors:', error.message);
        }
        // Initialize WebSocket server
        wsManager = new server_1.default(server);
        await (0, server_1.setupDatabaseTriggers)(wsManager);
        logger_1.default.info('✅ WebSocket server initialized');
        server.listen(PORT, () => {
            logger_1.default.info(`✅ Server running on port ${PORT}`);
            logger_1.default.info(`📊 API Base URL: ${API_BASE}`);
            logger_1.default.info(`🔌 WebSocket URL: ws://localhost:${PORT}/ws`);
            logger_1.default.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.default.info('SIGTERM received. Shutting down gracefully...');
    if (wsManager) {
        wsManager.close();
    }
    server.close(() => {
        logger_1.default.info('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', async () => {
    logger_1.default.info('SIGINT received. Shutting down gracefully...');
    if (wsManager) {
        wsManager.close();
    }
    server.close(() => {
        logger_1.default.info('Server closed');
        process.exit(0);
    });
});
startServer();
exports.default = app;
//# sourceMappingURL=server.js.map