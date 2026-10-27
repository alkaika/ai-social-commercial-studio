import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { generateMotion } from '@/lib/muse/visual';

export async function POST(req: NextRequest) {
  try {
    let key = 'DEMO', baseUrl = '';
    try { ({ key, baseUrl } = byokHeaders(req)); } catch {}
    const { imageUrl, prompt } = await req.json();
    return NextResponse.json(await generateMotion({ key, baseUrl, imageUrl, prompt }));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Motion failed.' }, { status: 500 });
  }
}
