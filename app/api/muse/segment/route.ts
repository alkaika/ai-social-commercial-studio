import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { segmentImage } from '@/lib/muse/visual';
import { routeError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const { key, baseUrl } = await byokHeaders(req);
    const { imageUrl } = await req.json();
    return NextResponse.json(await segmentImage({ key, baseUrl, imageUrl }));
  } catch (e: any) {
    return NextResponse.json({ error: routeError(e, 'Segmentation failed — please try again.') }, { status: 400 });
  }
}
