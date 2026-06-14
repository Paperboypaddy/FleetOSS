import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || 'postgres://fleetoss:fleetoss_dev@localhost:5432/fleetoss',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET || 'fleetoss',
  },
  redisUrl: process.env.REDIS_URL,
};
