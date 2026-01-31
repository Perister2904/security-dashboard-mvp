import Redis from 'ioredis';
export declare const redis: Redis;
export declare function cacheSet(key: string, value: any, expirySeconds?: number): Promise<void>;
export declare function cacheGet<T>(key: string): Promise<T | null>;
export declare function cacheDel(key: string): Promise<void>;
export declare function cacheInvalidatePattern(pattern: string): Promise<void>;
export declare function testRedisConnection(): Promise<boolean>;
//# sourceMappingURL=redis.d.ts.map