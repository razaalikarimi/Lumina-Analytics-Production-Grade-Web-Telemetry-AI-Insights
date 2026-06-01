// Batch processing module for bulk inserting events and sessions to MySQL database
import { prisma } from './db';
import { parseClientDetails } from './parser';

export interface TrackJob {
  apiKey: string;
  sessionId: string;
  eventName: string;
  eventData?: any;
  url: string;
  referrer?: string;
  userAgent?: string;
  ip: string;
  timestamp: string;
}

// Simple in-memory cache for API keys -> Website ID
const apiKeyCache = new Map<string, string>();

/**
 * Resolves a list of API keys to Website IDs in bulk
 */
async function resolveWebsites(apiKeys: string[]): Promise<Map<string, string>> {
  const uniqueKeys = Array.from(new Set(apiKeys));
  const resolved = new Map<string, string>();
  const keysToQuery: string[] = [];

  // Check cache first
  for (const key of uniqueKeys) {
    if (apiKeyCache.has(key)) {
      resolved.set(key, apiKeyCache.get(key)!);
    } else {
      keysToQuery.push(key);
    }
  }

  if (keysToQuery.length > 0) {
    const websites = await prisma.website.findMany({
      where: { apiKey: { in: keysToQuery } },
      select: { id: true, apiKey: true },
    });

    for (const site of websites) {
      apiKeyCache.set(site.apiKey, site.id);
      resolved.set(site.apiKey, site.id);
    }
  }

  return resolved;
}

/**
 * Process a batch of jobs and write them to MySQL.
 */
export async function processBatch(jobs: TrackJob[]): Promise<void> {
  if (jobs.length === 0) return;

  console.log(`Processing batch of ${jobs.length} jobs...`);

  try {
    // 1. Resolve all API keys
    const apiKeys = jobs.map(j => j.apiKey);
    const apiKeyToIdMap = await resolveWebsites(apiKeys);

    // Filter jobs with valid API keys and attach websiteId
    const resolvedJobs = jobs
      .map(job => {
        const websiteId = apiKeyToIdMap.get(job.apiKey);
        return websiteId ? { ...job, websiteId } : null;
      })
      .filter((j): j is TrackJob & { websiteId: string } => j !== null);

    if (resolvedJobs.length === 0) {
      console.log('No jobs in batch had valid API keys. Skipping.');
      return;
    }

    // 2. Identify unique sessions in the batch
    const uniqueSessionKeys = new Map<string, TrackJob & { websiteId: string }>();
    for (const job of resolvedJobs) {
      const key = `${job.websiteId}:${job.sessionId}`;
      if (!uniqueSessionKeys.has(key)) {
        uniqueSessionKeys.set(key, job);
      }
    }

    // Check which sessions already exist
    const sessionChecks = Array.from(uniqueSessionKeys.keys()).map(key => {
      const [websiteId, sessionId] = key.split(':');
      return { websiteId, sessionId };
    });

    // Query existing sessions. For large batches, we construct a query.
    // To be efficient, we can chunk or query using OR conditions:
    const existingSessions = await prisma.session.findMany({
      where: {
        OR: sessionChecks,
      },
      select: {
        websiteId: true,
        sessionId: true,
      },
    });

    const existingSessionSet = new Set(
      existingSessions.map(s => `${s.websiteId}:${s.sessionId}`)
    );

    // Identify which sessions are missing
    const sessionsToCreate = [];
    for (const [key, job] of uniqueSessionKeys.entries()) {
      if (!existingSessionSet.has(key)) {
        const clientDetails = parseClientDetails(job.userAgent, job.ip);
        sessionsToCreate.push({
          websiteId: job.websiteId,
          sessionId: job.sessionId,
          browser: clientDetails.browser,
          os: clientDetails.os,
          device: clientDetails.device,
          country: clientDetails.country,
          createdAt: new Date(job.timestamp),
        });
      }
    }

    // 3. Insert missing sessions in bulk
    if (sessionsToCreate.length > 0) {
      console.log(`Creating ${sessionsToCreate.length} missing sessions...`);
      await prisma.session.createMany({
        data: sessionsToCreate,
        skipDuplicates: true,
      });
    }

    // 4. Insert events in bulk
    const eventsToCreate = resolvedJobs.map(job => ({
      sessionId: job.sessionId,
      websiteId: job.websiteId,
      eventName: job.eventName,
      eventData: job.eventData ? job.eventData : undefined,
      url: job.url,
      referrer: job.referrer || null,
      timestamp: new Date(job.timestamp),
    }));

    console.log(`Inserting ${eventsToCreate.length} events...`);
    await prisma.event.createMany({
      data: eventsToCreate,
    });

    console.log(`Successfully completed batch processing.`);
  } catch (error) {
    console.error('Failed to process batch:', error);
    throw error;
  }
}
