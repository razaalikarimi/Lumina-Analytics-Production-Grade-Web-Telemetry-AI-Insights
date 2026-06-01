import { prisma } from './db';
import crypto from 'crypto';

async function seed() {
  console.log('Starting database seeding...');

  // 1. Clean existing data (optional, but good for clean slate)
  await prisma.event.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.website.deleteMany({});

  console.log('Cleaned database tables.');

  // 2. Create the demo website
  const apiKey = 'demo-api-key-123';
  const website = await prisma.website.create({
    data: {
      name: 'Acme Corp (Demo Website)',
      domain: 'acme.com',
      apiKey: apiKey,
    },
  });

  console.log(`Created website: ${website.name} with API Key: ${website.apiKey}`);

  // Config parameters
  const now = new Date();
  const pages = [
    { url: 'https://acme.com/', title: 'Acme Corp | Home' },
    { url: 'https://acme.com/pricing', title: 'Acme Corp | Pricing' },
    { url: 'https://acme.com/features', title: 'Acme Corp | Features' },
    { url: 'https://acme.com/docs', title: 'Acme Corp | Documentation' },
    { url: 'https://acme.com/blog/intro-to-analytics', title: 'Acme Corp Blog | Intro to Analytics' },
    { url: 'https://acme.com/signup', title: 'Acme Corp | Create Account' },
  ];

  const referrers = [
    'https://google.com',
    'https://github.com',
    'https://twitter.com',
    'https://linkedin.com',
    'https://news.ycombinator.com',
    null,
  ];

  const countries = ['US', 'US', 'US', 'GB', 'GB', 'IN', 'IN', 'DE', 'CA', 'FR', 'AU', 'JP'];
  const browsers = ['Chrome', 'Chrome', 'Chrome', 'Safari', 'Safari', 'Firefox', 'Edge', 'Opera'];
  const osList = ['Windows', 'Windows', 'macOS', 'macOS', 'iOS', 'Android', 'Linux'];
  const devices = ['Desktop', 'Desktop', 'Desktop', 'Mobile', 'Mobile', 'Tablet'];

  const sessionsToCreate = [];
  const eventsToCreate = [];

  // Generate data for the last 30 days
  for (let day = 30; day >= 0; day--) {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() - day);

    // Number of sessions today (creates a slight upward trend with weekly cycles)
    const dayOfWeek = targetDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseTraffic = 40 + Math.floor(Math.random() * 40);
    const dayTraffic = isWeekend ? Math.floor(baseTraffic * 0.6) : baseTraffic;
    
    // Add anomaly spike on target day 12 (DDoS or viral post)
    const finalTraffic = day === 12 ? dayTraffic * 3.5 : dayTraffic;

    console.log(`Generating ${finalTraffic} sessions for ${targetDate.toDateString()}...`);

    for (let s = 0; s < finalTraffic; s++) {
      const sessionId = crypto.randomUUID();
      
      // Random attributes based on distributions
      const country = countries[Math.floor(Math.random() * countries.length)];
      const browser = browsers[Math.floor(Math.random() * browsers.length)];
      const device = devices[Math.floor(Math.random() * devices.length)];
      
      // Keep OS matching device logically
      let os = osList[Math.floor(Math.random() * osList.length)];
      if (device === 'Mobile') {
        os = Math.random() > 0.5 ? 'iOS' : 'Android';
      } else if (device === 'Tablet') {
        os = 'iOS';
      } else if (os === 'iOS' || os === 'Android') {
        os = Math.random() > 0.5 ? 'Windows' : 'macOS';
      }

      // Session timestamp distributed throughout the day
      const sessionTime = new Date(targetDate);
      sessionTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

      sessionsToCreate.push({
        id: crypto.randomUUID(),
        websiteId: website.id,
        sessionId: sessionId,
        browser,
        os,
        device,
        country,
        createdAt: sessionTime,
      });

      // Events for this session (1 to 5 pages visited)
      const depth = 1 + Math.floor(Math.random() * 4);
      const referrer = referrers[Math.floor(Math.random() * referrers.length)];

      let currentSessionTime = new Date(sessionTime);

      for (let p = 0; p < depth; p++) {
        // Flow: home -> features/pricing -> pricing -> signup
        let pageIdx = 0;
        if (p > 0) {
          pageIdx = 1 + Math.floor(Math.random() * (pages.length - 1));
        }
        
        const page = pages[pageIdx];

        eventsToCreate.push({
          sessionId: sessionId,
          websiteId: website.id,
          eventName: 'pageview',
          eventData: { title: page.title },
          url: page.url,
          referrer: p === 0 ? referrer : pages[0].url,
          timestamp: new Date(currentSessionTime),
        });

        // Add custom event for signup or pricing click
        if (page.url.includes('/signup') && Math.random() > 0.4) {
          currentSessionTime.setSeconds(currentSessionTime.getSeconds() + 15);
          eventsToCreate.push({
            sessionId: sessionId,
            websiteId: website.id,
            eventName: 'click_signup',
            eventData: { form: 'header_main' },
            url: page.url,
            referrer: pages[0].url,
            timestamp: new Date(currentSessionTime),
          });
        } else if (page.url.includes('/pricing') && Math.random() > 0.5) {
          currentSessionTime.setSeconds(currentSessionTime.getSeconds() + 10);
          eventsToCreate.push({
            sessionId: sessionId,
            websiteId: website.id,
            eventName: 'click_pricing',
            eventData: { plan: 'tier_pro' },
            url: page.url,
            referrer: pages[0].url,
            timestamp: new Date(currentSessionTime),
          });
        }

        // Add some delay for next pageview (10 seconds to 3 minutes)
        currentSessionTime.setSeconds(currentSessionTime.getSeconds() + 10 + Math.floor(Math.random() * 170));
      }
    }
  }

  // Insert sessions in chunks of 500
  console.log(`Inserting ${sessionsToCreate.length} sessions...`);
  const chunkSize = 500;
  for (let i = 0; i < sessionsToCreate.length; i += chunkSize) {
    const chunk = sessionsToCreate.slice(i, i + chunkSize);
    await prisma.session.createMany({ data: chunk });
  }

  // Insert events in chunks of 1000
  console.log(`Inserting ${eventsToCreate.length} events...`);
  for (let i = 0; i < eventsToCreate.length; i += chunkSize * 2) {
    const chunk = eventsToCreate.slice(i, i + chunkSize * 2);
    await prisma.event.createMany({ data: chunk });
  }

  console.log('Database seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
