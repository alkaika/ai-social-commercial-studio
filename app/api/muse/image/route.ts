import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { generateImage } from '@/lib/muse/visual';

export async function POST(req: NextRequest) {
  try {
    let key = 'DEMO', baseUrl = '';
    try { ({ key, baseUrl } = byokHeaders(req)); } catch {}
    const { prompt, aspect } = await req.json();
    return NextResponse.json(await generateImage({ key, baseUrl, prompt, aspect }));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Image failed.' }, { status: 500 });
  }
}
