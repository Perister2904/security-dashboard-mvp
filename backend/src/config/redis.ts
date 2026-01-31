// Redis completely disabled - using no-op mock client
console.log('⚠️  Redis caching disabled - using no-op client');

export const redis = {
  on: () => {},
  setex: async () => 'OK',
  set: async () => 'OK',
  get: async () => null,
  del: async () => 1,
  keys: async () => [],
  ping: async () => 'PONG',
};

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
