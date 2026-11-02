import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { segmentImage } from '@/lib/muse/visual';

export async function POST(req: NextRequest) {
  try {
    const { key, baseUrl } = byokHeaders(req);
    const { imageUrl } = await req.json();
    return NextResponse.json(await segmentImage({ key, baseUrl, imageUrl }));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Segment failed.' }, { status: 400 });
  }
}
