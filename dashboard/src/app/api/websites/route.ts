import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
  try {
    const websites = await prisma.website.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(websites);
  } catch (error) {
    console.error('API Websites GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch websites' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, domain } = await request.json();
    if (!name || !domain) {
      return NextResponse.json({ error: 'Missing name or domain' }, { status: 400 });
    }

    const apiKey = crypto.randomUUID();
    const website = await prisma.website.create({
      data: {
        name,
        domain,
        apiKey,
      },
    });

    return NextResponse.json(website, { status: 201 });
  } catch (error) {
    console.error('API Websites POST error:', error);
    return NextResponse.json({ error: 'Failed to create website' }, { status: 500 });
  }
}
