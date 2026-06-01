import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateWeeklyExecutiveSummary } from '@/lib/gemini';
import PDFDocument from 'pdfkit';

// Helper to format duration (seconds) into mm:ss
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Function to generate the PDF Buffer using PDFKit
function buildReportPdf(
  siteName: string, 
  domain: string, 
  stats: any, 
  aiSummary: any, 
  dateRangeStr: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // --- COLORS ---
      const primaryColor = '#1e1b4b'; // Deep Indigo
      const secondaryColor = '#4f46e5'; // Indigo accent
      const textColor = '#334155'; // Slate dark
      const lightBg = '#f8fafc'; // Off-white/slate
      const dividerColor = '#cbd5e1';

      // --- HEADER BAND ---
      doc.rect(0, 0, 595.28, 120).fill(primaryColor);
      
      doc.fillColor('#ffffff')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text('EXECUTIVE PERFORMANCE REPORT', 50, 40);

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#94a3b8')
         .text(`${siteName} (${domain})  |  AI-Generated Strategic Insights`, 50, 68);

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#e2e8f0')
         .text(`Period: ${dateRangeStr}`, 50, 84);

      // --- KPI GRID (Page 1) ---
      doc.y = 150;
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('1. Key Performance Indicators', 50, doc.y);
      
      // Draw grid container
      doc.y += 10;
      const kpiY = doc.y;
      doc.rect(50, kpiY, 495, 60).fill(lightBg).stroke('#e2e8f0');

      // Col 1: Pageviews
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text('PAGEVIEWS', 70, kpiY + 15);
      doc.fontSize(16).font('Helvetica-Bold').fillColor(secondaryColor).text((stats.totalPageviews || 0).toLocaleString(), 70, kpiY + 28);

      // Col 2: Unique Visitors
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text('UNIQUE VISITORS', 190, kpiY + 15);
      doc.fontSize(16).font('Helvetica-Bold').fillColor(secondaryColor).text((stats.uniqueVisitors || 0).toLocaleString(), 190, kpiY + 28);

      // Col 3: Bounce Rate
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text('BOUNCE RATE', 330, kpiY + 15);
      doc.fontSize(16).font('Helvetica-Bold').fillColor(secondaryColor).text(`${stats.bounceRate || 0}%`, 330, kpiY + 28);

      // Col 4: Avg Duration
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text('AVG DURATION', 440, kpiY + 15);
      doc.fontSize(16).font('Helvetica-Bold').fillColor(secondaryColor).text(formatDuration(stats.avgSessionDuration || 0), 440, kpiY + 28);

      // --- EXECUTIVE OVERVIEW ---
      doc.y = kpiY + 90;
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('2. Executive Overview', 50, doc.y);

      doc.y += 8;
      doc.fontSize(10.5)
         .font('Helvetica')
         .fillColor(textColor)
         .text(aiSummary.overview || 'Overview not available.', {
           width: 495,
           align: 'justify',
           lineGap: 4
         });

      // --- SEGMENT BREAKDOWN (Top Lists) ---
      doc.y += 30;
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('Traffic Source & Device Summaries', 50, doc.y);
      
      doc.y += 8;
      const listsY = doc.y;
      
      // Top Pages
      doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('Top Content Views', 50, listsY);
      doc.font('Helvetica').fillColor(textColor);
      let pageOffset = listsY + 15;
      stats.topPages.slice(0, 3).forEach((p: any, idx: number) => {
        const cleanTitle = p.title.length > 30 ? p.title.substring(0, 30) + '...' : p.title;
        doc.text(`${idx + 1}. ${cleanTitle} (${p.count} views)`, 50, pageOffset);
        pageOffset += 15;
      });

      // Top Referrers
      doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('Top Referrer Domains', 300, listsY);
      doc.font('Helvetica').fillColor(textColor);
      let refOffset = listsY + 15;
      stats.topReferrers.slice(0, 3).forEach((r: any, idx: number) => {
        doc.text(`${idx + 1}. ${r.name} (${r.count} sessions)`, 300, refOffset);
        refOffset += 15;
      });

      // Add Footer on page 1
      doc.fontSize(8).fillColor('#94a3b8').text('Generated automatically by Acme AI Analytics Engine. Confidential executive document.', 50, 770, { align: 'center' });

      // ==========================================
      // PAGE 2: ANALYSIS & STRATEGY
      // ==========================================
      doc.addPage();

      // Top Header Page 2
      doc.rect(0, 0, 595.28, 20).fill(primaryColor);

      doc.y = 50;
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('3. Key Traffic Strengths', 50, doc.y);

      doc.y += 10;
      aiSummary.strengths.forEach((strength: string) => {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(secondaryColor)
           .text('•  ', { continued: true })
           .font('Helvetica')
           .fillColor(textColor)
           .text(strength, { lineGap: 3, width: 495 });
        doc.y += 4;
      });

      doc.y += 15;
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('4. Growth Opportunities', 50, doc.y);

      doc.y += 10;
      aiSummary.opportunities.forEach((opportunity: string) => {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(secondaryColor)
           .text('•  ', { continued: true })
           .font('Helvetica')
           .fillColor(textColor)
           .text(opportunity, { lineGap: 3, width: 495 });
        doc.y += 4;
      });

      doc.y += 20;
      // Recommendations Box (Highlighted)
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor(primaryColor)
         .text('5. AI Actionable Recommendations', 50, doc.y);

      doc.y += 10;
      const recsBoxY = doc.y;
      doc.rect(50, recsBoxY - 5, 495, 140).fill(lightBg).stroke('#e2e8f0');

      doc.y = recsBoxY;
      aiSummary.recommendations.forEach((rec: string, idx: number) => {
        doc.fontSize(10.5)
           .font('Helvetica-Bold')
           .fillColor(secondaryColor)
           .text(`${idx + 1}. `, { continued: true })
           .font('Helvetica')
           .fillColor(textColor)
           .text(rec, { lineGap: 5, width: 460 });
        doc.y += 6;
      });

      // Footer page 2
      doc.fontSize(8).fillColor('#94a3b8').text('Page 2 of 2  |  Acme Corp Strategic Blueprint', 50, 770, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    // 1. Fetch website info
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
    });

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    // 2. Fetch last 7 days of metrics for PDF
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    const events = await prisma.event.findMany({
      where: {
        websiteId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    const uniqueSessionIds = Array.from(new Set(events.map(e => e.sessionId)));
    const uniqueVisitors = uniqueSessionIds.length;
    const pageviews = events.filter(e => e.eventName === 'pageview');
    const totalPageviews = pageviews.length;

    // Fetch sessions
    const sessions = await prisma.session.findMany({
      where: {
        websiteId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        sessionId: {
          in: uniqueSessionIds,
        },
      },
    });

    // Compute Bounce & Duration
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
      if (sessEvents.length === 1) bouncedCount++;
      if (sessEvents.length > 1) {
        const timestamps = sessEvents.map(e => new Date(e.timestamp).getTime());
        totalDurationMs += Math.max(...timestamps) - Math.min(...timestamps);
        durationCount++;
      }
    }

    const totalSessions = eventsBySession.size;
    const bounceRate = totalSessions > 0 ? Math.round((bouncedCount / totalSessions) * 100) : 0;
    const avgSessionDuration = durationCount > 0 ? Math.round((totalDurationMs / durationCount) / 1000) : 0;

    // Top Pages
    const pageCounts = new Map<string, { url: string; title: string; count: number }>();
    for (const pv of pageviews) {
      const title = (pv.eventData as any)?.title || pv.url;
      if (!pageCounts.has(pv.url)) {
        pageCounts.set(pv.url, { url: pv.url, title, count: 0 });
      }
      pageCounts.get(pv.url)!.count++;
    }
    const topPages = Array.from(pageCounts.values()).sort((a, b) => b.count - a.count);

    // Top Referrers
    const referrerCounts = new Map<string, number>();
    for (const pv of pageviews) {
      let ref = pv.referrer || 'Direct';
      if (ref !== 'Direct') {
        try {
          ref = new URL(ref).hostname;
        } catch (_) {}
      }
      referrerCounts.set(ref, (referrerCounts.get(ref) || 0) + 1);
    }
    const topReferrers = Array.from(referrerCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Device breakdown
    const deviceMap = new Map<string, number>();
    for (const s of sessions) {
      deviceMap.set(s.device || 'Unknown', (deviceMap.get(s.device || 'Unknown') || 0) + 1);
    }
    const deviceBreakdown = Array.from(deviceMap.entries()).map(([name, count]) => ({ name, count }));

    const statsSummary = {
      totalPageviews,
      uniqueVisitors,
      bounceRate,
      avgSessionDuration: formatDuration(avgSessionDuration),
      topPages: topPages.slice(0, 5),
      topReferrers: topReferrers.slice(0, 5),
      deviceBreakdown,
    };

    // 3. Query Gemini for AI summary
    const aiSummary = await generateWeeklyExecutiveSummary(statsSummary);

    // Date range string for report header
    const dateRangeStr = `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;

    // 4. Build PDF
    const pdfBuffer = await buildReportPdf(
      website.name,
      website.domain,
      { ...statsSummary, topPages, topReferrers },
      aiSummary,
      dateRangeStr
    );

    // 5. Return PDF Stream response
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="weekly-report-${website.domain}.pdf"`,
      },
    });
  } catch (error) {
    console.error('API AI Report GET error:', error);
    return NextResponse.json({ error: 'Failed to generate weekly PDF report' }, { status: 500 });
  }
}
