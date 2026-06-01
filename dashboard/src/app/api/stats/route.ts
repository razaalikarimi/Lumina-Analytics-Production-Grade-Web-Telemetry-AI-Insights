import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');
    const period = searchParams.get('period') || '7d'; // 'today', '7d', '30d', 'custom'
    const fromDateParam = searchParams.get('from');
    const toDateParam = searchParams.get('to');
    
    // Segmentation filters
    const filterBrowser = searchParams.get('browser');
    const filterDevice = searchParams.get('device');
    const filterCountry = searchParams.get('country');

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // Determine date range
    let startDate = new Date();
    let endDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === '30d') {
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'custom' && fromDateParam && toDateParam) {
      startDate = new Date(fromDateParam);
      endDate = new Date(toDateParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to 7d
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    }

    // Build event where clause
    const eventWhere: any = {
      websiteId,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Build session where clause (to filter by session criteria)
    const sessionRelationFilter: any = {};
    if (filterBrowser) sessionRelationFilter.browser = filterBrowser;
    if (filterDevice) sessionRelationFilter.device = filterDevice;
    if (filterCountry) sessionRelationFilter.country = filterCountry;

    if (Object.keys(sessionRelationFilter).length > 0) {
      eventWhere.session = sessionRelationFilter;
    }

    // 1. Fetch Events
    const events = await prisma.event.findMany({
      where: eventWhere,
      orderBy: { timestamp: 'asc' },
    });

    const totalEventsCount = events.length;

    // Filter pageviews
    const pageviews = events.filter(e => e.eventName === 'pageview');
    const totalPageviews = pageviews.length;

    // Unique Visitors (unique sessions)
    const uniqueSessionIds = Array.from(new Set(events.map(e => e.sessionId)));
    const uniqueVisitors = uniqueSessionIds.length;

    // 2. Fetch Sessions in the period to compute distributions
    const sessionWhere: any = {
      websiteId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      sessionId: {
        in: uniqueSessionIds, // Only sessions that actually logged events in this period
      },
    };

    if (filterBrowser) sessionWhere.browser = filterBrowser;
    if (filterDevice) sessionWhere.device = filterDevice;
    if (filterCountry) sessionWhere.country = filterCountry;

    const sessions = await prisma.session.findMany({
      where: sessionWhere,
    });

    // 3. Compute Bounce Rate and Average Duration
    // Group events by session to calculate session depths and durations
    const eventsBySession = new Map<string, typeof events>();
    for (const event of events) {
      if (!eventsBySession.has(event.sessionId)) {
        eventsBySession.set(event.sessionId, []);
      }
      eventsBySession.get(event.sessionId)!.push(event);
    }

    let bouncedCount = 0;
    let totalDurationMs = 0;
    let durationCount = 0;

    for (const [_, sessEvents] of eventsBySession.entries()) {
      // Bounce = session with only 1 event
      if (sessEvents.length === 1) {
        bouncedCount++;
      }

      // Duration = max(timestamp) - min(timestamp)
      if (sessEvents.length > 1) {
        const timestamps = sessEvents.map(e => new Date(e.timestamp).getTime());
        const duration = Math.max(...timestamps) - Math.min(...timestamps);
        totalDurationMs += duration;
        durationCount++;
      }
    }

    const totalSessions = eventsBySession.size;
    const bounceRate = totalSessions > 0 ? Math.round((bouncedCount / totalSessions) * 100) : 0;
    
    // Average duration in seconds
    const avgSessionDuration = durationCount > 0 
      ? Math.round((totalDurationMs / durationCount) / 1000) 
      : 0;

    // 4. Chart Data: Pageviews and Visitors grouped by Day
    const chartDataMap = new Map<string, { date: string; pageviews: number; visitors: Set<string> }>();
    
    // Initialize date map with all dates in the range to prevent gaps
    const dateCursor = new Date(startDate);
    while (dateCursor <= endDate) {
      const dateStr = dateCursor.toISOString().split('T')[0];
      chartDataMap.set(dateStr, { date: dateStr, pageviews: 0, visitors: new Set() });
      dateCursor.setDate(dateCursor.getDate() + 1);
    }

    // Populate chart data
    for (const event of events) {
      const dateStr = new Date(event.timestamp).toISOString().split('T')[0];
      let point = chartDataMap.get(dateStr);
      if (!point) {
        // Fallback for timezone boundary events
        point = { date: dateStr, pageviews: 0, visitors: new Set() };
        chartDataMap.set(dateStr, point);
      }
      if (event.eventName === 'pageview') {
        point.pageviews++;
      }
      point.visitors.add(event.sessionId);
    }

    const chartData = Array.from(chartDataMap.values()).map(point => ({
      date: point.date,
      pageviews: point.pageviews,
      visitors: point.visitors.size,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // 5. Top Pages Breakdown
    const pageCounts = new Map<string, { url: string; title: string; count: number }>();
    for (const pv of pageviews) {
      const title = (pv.eventData as any)?.title || pv.url;
      const key = pv.url;
      if (!pageCounts.has(key)) {
        pageCounts.set(key, { url: pv.url, title, count: 0 });
      }
      pageCounts.get(key)!.count++;
    }
    const topPages = Array.from(pageCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 6. Top Referrers Breakdown
    const referrerCounts = new Map<string, number>();
    for (const event of events) {
      if (event.eventName === 'pageview') {
        // Parse domain from referrer URL
        let ref = event.referrer || 'Direct';
        if (ref !== 'Direct') {
          try {
            const urlObj = new URL(ref);
            ref = urlObj.hostname;
          } catch (_) {
            // Keep original string if parsing fails
          }
        }
        referrerCounts.set(ref, (referrerCounts.get(ref) || 0) + 1);
      }
    }
    const topReferrers = Array.from(referrerCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 7. Device, Country, Browser & OS Breakdowns (from Sessions)
    const deviceMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const osMap = new Map<string, number>();

    for (const sess of sessions) {
      const dev = sess.device || 'Unknown';
      const ctry = sess.country || 'Unknown';
      const brow = sess.browser || 'Unknown';
      const os = sess.os || 'Unknown';

      deviceMap.set(dev, (deviceMap.get(dev) || 0) + 1);
      countryMap.set(ctry, (countryMap.get(ctry) || 0) + 1);
      browserMap.set(brow, (browserMap.get(brow) || 0) + 1);
      osMap.set(os, (osMap.get(os) || 0) + 1);
    }

    const deviceBreakdown = Array.from(deviceMap.entries()).map(([name, count]) => ({ name, count }));
    const countryBreakdown = Array.from(countryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const browserBreakdown = Array.from(browserMap.entries()).map(([name, count]) => ({ name, count }));
    const osBreakdown = Array.from(osMap.entries()).map(([name, count]) => ({ name, count }));

    // 8. Custom Events Breakdown
    const customEventsMap = new Map<string, number>();
    for (const event of events) {
      if (event.eventName !== 'pageview') {
        customEventsMap.set(event.eventName, (customEventsMap.get(event.eventName) || 0) + 1);
      }
    }
    const customEvents = Array.from(customEventsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalPageviews,
      uniqueVisitors,
      bounceRate,
      avgSessionDuration,
      chartData,
      topPages,
      topReferrers,
      deviceBreakdown,
      countryBreakdown,
      browserBreakdown,
      osBreakdown,
      customEvents,
    });
  } catch (error) {
    console.error('API Stats GET error:', error);
    return NextResponse.json({ error: 'Failed to aggregate statistics' }, { status: 500 });
  }
}
