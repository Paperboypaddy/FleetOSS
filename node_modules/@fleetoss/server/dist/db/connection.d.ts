export declare function getDb(): import("drizzle-orm/node-postgres").NodePgDatabase<Record<string, unknown>> & {
    $client: import("drizzle-orm/node-postgres").NodePgClient;
};
export declare function getPool(): import("pg").Pool;
export declare function closeDb(): Promise<void>;
//# sourceMappingURL=connection.d.ts.map