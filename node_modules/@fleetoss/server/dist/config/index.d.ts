import 'dotenv/config';
export declare const config: {
    port: number;
    host: string;
    databaseUrl: string;
    jwtSecret: string;
    s3: {
        endpoint: string | undefined;
        accessKey: string | undefined;
        secretKey: string | undefined;
        bucket: string;
    };
    redisUrl: string | undefined;
};
//# sourceMappingURL=index.d.ts.map