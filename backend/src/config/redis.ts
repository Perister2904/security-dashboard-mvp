import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Support both REDIS_URL (for cloud providers like Upstash)
// and individual connection params (for local development)
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL // Upstash and other cloud providers use connection URL
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

// Redis accepts both URL string and config object
export const redis = typeof redisConfig === 'string' 
  ? new Redis(redisConfig)
  : new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✅ Redis connection established');
});

redis.on('error', (err: Error) => {
  console.error('❌ Redis connection error:', err);
});

redis.on('ready', () => {
  console.log('✅ Redis is ready to accept commands');
});

// Cache helper functions
export async function cacheSet(
  key: string,
  value: any,
  expirySeconds?: number
): Promise<void> {
  const serialized = JSON.stringify(value);
  if (expirySeconds) {
    await redis.setex(key, expirySeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  if (!cached) return null;
  return JSON.parse(cached) as T;
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    console.log('✅ Redis connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection test failed:', error);
    return false;
  }
}
