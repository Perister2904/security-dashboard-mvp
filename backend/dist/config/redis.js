"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.cacheSet = cacheSet;
exports.cacheGet = cacheGet;
exports.cacheDel = cacheDel;
exports.cacheInvalidatePattern = cacheInvalidatePattern;
exports.testRedisConnection = testRedisConnection;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Support both REDIS_URL (for cloud providers like Upstash)
// and individual connection params (for local development)
const redisConfig = process.env.REDIS_URL
    ? process.env.REDIS_URL // Upstash and other cloud providers use connection URL
    : {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
    };
// Redis accepts both URL string and config object
exports.redis = typeof redisConfig === 'string'
    ? new ioredis_1.default(redisConfig)
    : new ioredis_1.default(redisConfig);
exports.redis.on('connect', () => {
    console.log('✅ Redis connection established');
});
exports.redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
});
exports.redis.on('ready', () => {
    console.log('✅ Redis is ready to accept commands');
});
// Cache helper functions
async function cacheSet(key, value, expirySeconds) {
    const serialized = JSON.stringify(value);
    if (expirySeconds) {
        await exports.redis.setex(key, expirySeconds, serialized);
    }
    else {
        await exports.redis.set(key, serialized);
    }
}
async function cacheGet(key) {
    const cached = await exports.redis.get(key);
    if (!cached)
        return null;
    return JSON.parse(cached);
}
async function cacheDel(key) {
    await exports.redis.del(key);
}
async function cacheInvalidatePattern(pattern) {
    const keys = await exports.redis.keys(pattern);
    if (keys.length > 0) {
        await exports.redis.del(...keys);
    }
}
async function testRedisConnection() {
    try {
        await exports.redis.ping();
        console.log('✅ Redis connection test successful');
        return true;
    }
    catch (error) {
        console.error('❌ Redis connection test failed:', error);
        return false;
    }
}
//# sourceMappingURL=redis.js.map