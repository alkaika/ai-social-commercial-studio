import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { checkCaptionsAvailability } from '@/lib/muse/voice';
import { routeError } from '@/lib/errors';

// Captions check (Voice Transcribe = STT-only, kept for auto-captions/QC).
// NOT voice synthesis — voice-over comes from meta.ai text-to-voice clips.
export async function POST(req: NextRequest) {
  try {
    const { key, baseUrl } = await byokHeaders(req);
    const { text } = await req.json();
    const out = await checkCaptionsAvailability({ key, baseUrl, text });
    return NextResponse.json({ ...out, captions: true, synthesis: false });
  } catch (e: any) {
    return NextResponse.json({ error: routeError(e, 'Captions check failed — please try again.') }, { status: 400 });
  }
}
