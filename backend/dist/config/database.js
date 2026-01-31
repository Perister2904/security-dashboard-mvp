"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.getClient = getClient;
exports.transaction = transaction;
exports.testConnection = testConnection;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Support both DATABASE_URL (for cloud providers like Neon, Supabase)
// and individual connection params (for local development)
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Always use SSL for Neon
        // Optimized for serverless (Vercel)
        max: 5, // Lower max connections for serverless
        idleTimeoutMillis: 0, // Disable idle timeout to prevent disconnection
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'security_dashboard',
        user: process.env.DB_USER || 'dashboard_user',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        min: parseInt(process.env.DB_POOL_MIN || '2'),
        max: parseInt(process.env.DB_POOL_MAX || '10'),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
exports.pool = new pg_1.Pool(poolConfig);
exports.pool.on('error', (err) => {
    console.error('Pool error on idle client (will retry):', err.message);
    // Don't exit - let the pool handle reconnection
});
async function query(text, params) {
    const start = Date.now();
    const res = await exports.pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
        console.warn('Slow query detected:', { text, duration, rows: res.rowCount });
    }
    return res;
}
async function getClient() {
    const client = await exports.pool.connect();
    return client;
}
async function transaction(callback) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function testConnection() {
    try {
        const result = await query('SELECT NOW()');
        console.log('✅ Database connection successful:', result.rows[0].now);
        return true;
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}
exports.default = exports.pool;
//# sourceMappingURL=database.js.map