import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { synthesizeVoice } from '@/lib/muse/voice';

export async function POST(req: NextRequest) {
  try {
    let key = 'DEMO', baseUrl = '';
    try { ({ key, baseUrl } = byokHeaders(req)); } catch {}
    const { text, voice, speed } = await req.json();
    const out = await synthesizeVoice({ key, baseUrl, text, voice, speed });
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Voice failed.' }, { status: 500 });
  }
}
