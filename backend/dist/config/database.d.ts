import { Pool, PoolClient } from 'pg';
export declare const pool: Pool;
export declare function query(text: string, params?: any[]): Promise<import("pg").QueryResult<any>>;
export declare function getClient(): Promise<PoolClient>;
export declare function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
export declare function testConnection(): Promise<boolean>;
export default pool;
//# sourceMappingURL=database.d.ts.map