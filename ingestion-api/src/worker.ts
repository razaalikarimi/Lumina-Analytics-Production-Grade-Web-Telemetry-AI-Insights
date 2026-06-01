import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { config } from './config';
import { processBatch, TrackJob } from './batch-processor';

console.log('Starting BullMQ background worker service...');

if (config.useMockQueue) {
  console.log('Worker running in MOCK mode. Redis queue worker is inactive since we are processing in-process.');
} else {
  try {
    const redisConnection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
    });

    redisConnection.on('error', (err) => {
      console.error('Worker Redis connection error:', err.message);
    });

    const jobBuffer: TrackJob[] = [];
    const BATCH_SIZE = 100;
    const FLUSH_INTERVAL = 500; // ms

    const flushBuffer = async () => {
      if (jobBuffer.length === 0) return;
      const batch = jobBuffer.splice(0, jobBuffer.length);
      try {
        await processBatch(batch);
      } catch (error) {
        console.error('Worker failed to write batch to DB:', error);
      }
    };

    // Periodically flush the queue
    setInterval(flushBuffer, FLUSH_INTERVAL);

    const worker = new Worker(
      'tracking-queue',
      async (job) => {
        jobBuffer.push(job.data as TrackJob);
        if (jobBuffer.length >= BATCH_SIZE) {
          await flushBuffer();
        }
      },
      {
        connection: redisConnection as any,
        concurrency: 1, // Single-worker sequential write for stability
      }
    );

    worker.on('active', (job) => {
      // Job started
    });

    worker.on('completed', (job) => {
      // Job completed in Redis queue
    });

    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    console.log('Worker listening for jobs on tracking-queue successfully.');
  } catch (error) {
    console.error('Failed to initialize Worker Redis connection:', error);
    console.log('Worker running in idle state.');
  }
}
