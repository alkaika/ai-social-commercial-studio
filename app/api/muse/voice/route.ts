import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { checkCaptionsAvailability } from '@/lib/muse/voice';

// Captions check (Voice Transcribe = STT-only, kept for auto-captions/QC).
// NOT voice synthesis — voice-over comes from meta.ai text-to-voice clips.
export async function POST(req: NextRequest) {
  try {
    let key = 'DEMO', baseUrl = '';
    try { ({ key, baseUrl } = byokHeaders(req)); } catch {}
    const { text } = await req.json();
    const out = await checkCaptionsAvailability({ key, baseUrl, text });
    return NextResponse.json({ ...out, captions: true, synthesis: false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Captions check failed.' }, { status: 500 });
  }
}
