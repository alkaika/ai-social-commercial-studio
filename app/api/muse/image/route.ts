import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { generateImage } from '@/lib/muse/visual';
import { routeError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const { key, baseUrl } = await byokHeaders(req);
    const { prompt, aspect } = await req.json();
    return NextResponse.json(await generateImage({ key, baseUrl, prompt, aspect }));
  } catch (e: any) {
    return NextResponse.json({ error: routeError(e, 'Image generation failed — please try again.') }, { status: 400 });
  }
}
