import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import { config } from './config';
import { prisma } from './db';
import { initQueue, addTrackJob, getActiveUsersCount } from './queue';

const app = express();

// Trust proxy for correct client IP detection behind load balancers
app.set('trust proxy', true);

// Configure CORS to allow tracker SDK from any origin
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));

app.use(express.json());

// Serve static files in the SDK folder (tracker.js, test-tracker.html)
app.use(express.static(path.join(__dirname, '../../sdk')));

// Initialize BullMQ queue or fallback
initQueue();

// Ingestion rate limiter: Max 200 requests per 10 seconds per IP
const trackLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracking requests, rate limit exceeded.' },
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', queueMode: config.useMockQueue ? 'Mock (In-Memory)' : 'BullMQ (Redis)' });
});

/**
 * Ingestion Endpoint
 * Receives tracked events, validates api_key, immediately queues, returns 202 Accepted.
 */
app.post('/track', trackLimiter, async (req, res) => {
  try {
    const apiKey = (req.headers['x-api-key'] || req.query.apiKey || req.body.apiKey) as string;
    const { sessionId, eventName, eventData, url, referrer } = req.body;

    if (!apiKey) {
       res.status(400).json({ error: 'Missing api_key in headers, query, or body.' });
       return;
    }

    if (!sessionId || !eventName || !url) {
       res.status(400).json({ error: 'Missing required tracking parameters: sessionId, eventName, url.' });
       return;
    }

    const userAgent = req.headers['user-agent'] || undefined;
    const ip = req.ip || '127.0.0.1';

    // Queue the telemetry job asynchronously
    await addTrackJob({
      apiKey,
      sessionId,
      eventName,
      eventData,
      url,
      referrer,
      userAgent,
      ip,
      timestamp: new Date().toISOString(),
    });

    // Respond immediately to the client snippet
    res.status(202).json({ status: 'Accepted' });
  } catch (error) {
    console.error('Error ingesting event:', error);
    res.status(500).json({ error: 'Internal server error while ingesting event.' });
  }
});

/**
 * SSE Endpoint: Real-time Live Active Users
 * Pushes active users count to the Next.js dashboard
 */
app.get('/api/live-users', async (req, res) => {
  const apiKey = req.query.apiKey as string;
  if (!apiKey) {
    res.status(400).json({ error: 'apiKey query parameter is required' });
    return;
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Flush first count
  const sendCount = async () => {
    try {
      const activeUsers = await getActiveUsersCount(apiKey);
      res.write(`data: ${JSON.stringify({ activeUsers })}\n\n`);
    } catch (err) {
      console.error('Failed to write active users to SSE:', err);
    }
  };

  await sendCount();

  // Poll Redis / Local store every 3 seconds for updates
  const intervalId = setInterval(sendCount, 3000);

  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
});

/**
 * Helper Endpoint: Create a new website
 */
app.post('/api/websites', async (req, res) => {
  const { name, domain } = req.body;
  if (!name || !domain) {
     res.status(400).json({ error: 'Missing name or domain.' });
     return;
  }

  try {
    const apiKey = crypto.randomUUID();
    const website = await prisma.website.create({
      data: {
        name,
        domain,
        apiKey,
      },
    });

     res.status(201).json(website);
  } catch (error) {
    console.error('Failed to create website:', error);
     res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * Helper Endpoint: List all websites
 */
app.get('/api/websites', async (req, res) => {
  try {
    const websites = await prisma.website.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(websites);
  } catch (error) {
    console.error('Failed to list websites:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Start the Express server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`Analytics Ingestion Server is running on http://localhost:${config.port}`);
  console.log(`Live user SSE stream available at http://localhost:${config.port}/api/live-users`);
});
