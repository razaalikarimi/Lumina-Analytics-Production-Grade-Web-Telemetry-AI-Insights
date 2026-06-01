import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from './config';
import { TrackJob, processBatch } from './batch-processor';

let bullQueue: Queue | null = null;
let redisConnection: Redis | null = null;

// Local in-memory queue fallback variables
const inMemoryQueue: TrackJob[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

const BATCH_INTERVAL_MS = 500;
const BATCH_SIZE_LIMIT = 100;

// Initialize queue based on configuration
export function initQueue() {
  if (config.useMockQueue) {
    console.log('Queue initialized in MOCK mode (In-Memory Queue). No Redis required.');
    startInMemoryWorker();
  } else {
    try {
      console.log(`Connecting to Redis at ${config.redisUrl} for BullMQ...`);
      redisConnection = new Redis(config.redisUrl, {
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
      });

      redisConnection.on('error', (err) => {
        console.error('Redis connection error:', err.message);
        console.log('Falling back to In-Memory Queue for local development...');
        config.useMockQueue = true;
        startInMemoryWorker();
      });

      redisConnection.on('connect', () => {
        console.log('Redis connected successfully.');
        bullQueue = new Queue('tracking-queue', {
          connection: redisConnection! as any,
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: 1000,
          },
        });
      });
    } catch (error) {
      console.error('Failed to initialize Redis queue:', error);
      console.log('Falling back to In-Memory Queue...');
      config.useMockQueue = true;
      startInMemoryWorker();
    }
  }
}

/**
 * Adds a tracking event to the processing queue.
 */
export async function addTrackJob(job: TrackJob): Promise<void> {
  // Always update Redis active users first (if Redis is connected)
  await trackActiveUserInRedis(job.apiKey, job.sessionId);

  if (config.useMockQueue || !bullQueue) {
    // In-memory queue logic
    inMemoryQueue.push(job);
    
    // Trigger immediate write if we hit the batch limit
    if (inMemoryQueue.length >= BATCH_SIZE_LIMIT) {
      flushInMemoryQueue();
    }
  } else {
    // BullMQ logic
    await bullQueue.add('track-event', job);
  }
}

/**
 * Setup a background worker for the in-memory fallback
 */
function startInMemoryWorker() {
  if (flushTimeout) return;

  const run = () => {
    flushInMemoryQueue();
    flushTimeout = setTimeout(run, BATCH_INTERVAL_MS);
  };
  
  flushTimeout = setTimeout(run, BATCH_INTERVAL_MS);
}

/**
 * Flush the in-memory array to the database
 */
async function flushInMemoryQueue() {
  if (inMemoryQueue.length === 0) return;

  // Splice all elements to process them
  const batch = inMemoryQueue.splice(0, inMemoryQueue.length);
  try {
    await processBatch(batch);
  } catch (error) {
    console.error('Failed to flush in-memory batch:', error);
    // Put them back at the end of the queue to retry
    inMemoryQueue.push(...batch);
  }
}

/**
 * Redis-based Real-time active session tracking
 */
async function trackActiveUserInRedis(apiKey: string, sessionId: string) {
  if (config.useMockQueue || !redisConnection || redisConnection.status !== 'ready') {
    // Local mock active user tracking (in-memory)
    trackLocalActiveUser(apiKey, sessionId);
    return;
  }

  try {
    const key = `active_users:${apiKey}`;
    const now = Date.now();
    // Add sessionId with score = current timestamp
    await redisConnection.zadd(key, now, sessionId);
    // Remove expired sessions (> 5 minutes / 300 seconds ago)
    await redisConnection.zremrangebyscore(key, 0, now - 300000);
    // Expire the key in 10 minutes to clean up empty sets
    await redisConnection.expire(key, 600);
  } catch (error) {
    // Ignore Redis errors for active user tracking and fallback
    trackLocalActiveUser(apiKey, sessionId);
  }
}

// Local mock tracking of active sessions
const localActiveUsers = new Map<string, Map<string, number>>(); // apiKey -> Map<sessionId, timestamp>

function trackLocalActiveUser(apiKey: string, sessionId: string) {
  if (!localActiveUsers.has(apiKey)) {
    localActiveUsers.set(apiKey, new Map());
  }
  const sessions = localActiveUsers.get(apiKey)!;
  sessions.set(sessionId, Date.now());

  // Clean up old sessions
  const cutoff = Date.now() - 300000;
  for (const [sid, ts] of sessions.entries()) {
    if (ts < cutoff) {
      sessions.delete(sid);
    }
  }
}

/**
 * Returns the count of active users in the last 5 minutes for a website
 */
export async function getActiveUsersCount(apiKey: string): Promise<number> {
  if (config.useMockQueue || !redisConnection || redisConnection.status !== 'ready') {
    const sessions = localActiveUsers.get(apiKey);
    if (!sessions) return 0;
    
    // Clean up first
    const cutoff = Date.now() - 300000;
    let count = 0;
    for (const [_, ts] of sessions.entries()) {
      if (ts >= cutoff) count++;
    }
    return count;
  }

  try {
    const key = `active_users:${apiKey}`;
    const now = Date.now();
    // Clean up
    await redisConnection.zremrangebyscore(key, 0, now - 300000);
    // Count remaining
    return await redisConnection.zcard(key);
  } catch (error) {
    console.error('Failed to get active users from Redis:', error);
    // Fallback to local map
    const sessions = localActiveUsers.get(apiKey);
    return sessions ? sessions.size : 0;
  }
}
