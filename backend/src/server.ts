import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import http from 'http';
import { testConnection as testDB } from './config/database';
import { testRedisConnection } from './config/redis';
import { ldapService } from './services/ldap.service';
import logger from './utils/logger';
import authRoutes from './routes/auth.routes';
import socRoutes from './routes/soc.routes';
import assetRoutes from './routes/asset.routes';
import riskRoutes from './routes/risk.routes';
import ceoRoutes from './routes/ceo.routes';
import WebSocketManager, { setupDatabaseTriggers } from './websocket/server';
import { connectorManager } from './connectors';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: process.env.CORS_CREDENTIALS === 'true',
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
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
app.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await testDB();
  const redisHealthy = await testRedisConnection();
  const ldapHealthy = await ldapService.testConnection();

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

app.use(`${API_BASE}/auth`, authRoutes);
app.use(`${API_BASE}/soc`, socRoutes);
app.use(`${API_BASE}/assets`, assetRoutes);
app.use(`${API_BASE}/risks`, riskRoutes);
app.use(`${API_BASE}/ceo`, ceoRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
  });
});

// Initialize WebSocket server
let wsManager: WebSocketManager;

// Start server
async function startServer() {
  try {
    logger.info('🚀 Starting Security Dashboard Backend...');

    // Test connections
    const dbConnected = await testDB();
    if (!dbConnected) {
      logger.error('❌ Database connection failed. Exiting...');
      process.exit(1);
    }

    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      logger.warn('⚠️  Redis connection failed. Caching will be disabled.');
    }

    const ldapConnected = await ldapService.testConnection();
    if (!ldapConnected) {
      logger.warn('⚠️  LDAP connection failed. AD authentication will be disabled.');
    }

    // Initialize connectors
    try {
      await connectorManager.initialize();
      logger.info('✅ Security tool connectors initialized');
    } catch (error: any) {
      logger.warn('⚠️  Failed to initialize connectors:', error.message);
    }

    // Initialize WebSocket server
    wsManager = new WebSocketManager(server);
    await setupDatabaseTriggers(wsManager);
    logger.info('✅ WebSocket server initialized');

    server.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`📊 API Base URL: ${API_BASE}`);
      logger.info(`🔌 WebSocket URL: ws://localhost:${PORT}/ws`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  if (wsManager) {
    wsManager.close();
  }
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  if (wsManager) {
    wsManager.close();
  }
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer();

export default app;
