import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateTrafficForecast, TrafficDataPoint } from '@/lib/gemini';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // 1. Fetch historical daily traffic for the last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const events = await prisma.event.findMany({
      where: {
        websiteId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        timestamp: true,
        eventName: true,
        sessionId: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Aggregate by date YYYY-MM-DD
    const dailyMap = new Map<string, { date: string; pageviews: number; visitors: Set<string> }>();
    
    // Seed the map to avoid date gaps
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      dailyMap.set(dateStr, { date: dateStr, pageviews: 0, visitors: new Set() });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const event of events) {
      const dateStr = new Date(event.timestamp).toISOString().split('T')[0];
      let point = dailyMap.get(dateStr);
      if (!point) {
        point = { date: dateStr, pageviews: 0, visitors: new Set() };
        dailyMap.set(dateStr, point);
      }
      if (event.eventName === 'pageview') {
        point.pageviews++;
      }
      point.visitors.add(event.sessionId);
    }

    const historicalData: TrafficDataPoint[] = Array.from(dailyMap.values()).map(point => ({
      date: point.date,
      pageviews: point.pageviews,
      visitors: point.visitors.size,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // 2. Call Gemini
    const forecast = await generateTrafficForecast(historicalData);

    return NextResponse.json({ forecast });
  } catch (error) {
    console.error('API AI Forecast GET error:', error);
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 });
  }
}
