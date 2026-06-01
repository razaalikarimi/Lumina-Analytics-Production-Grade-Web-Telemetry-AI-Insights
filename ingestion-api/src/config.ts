import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/analytics_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  useMockQueue: process.env.USE_MOCK_QUEUE === 'true' || !process.env.REDIS_URL,
};

// Simple validation
if (!config.databaseUrl) {
  console.warn('WARNING: DATABASE_URL is not set in environment.');
}
