import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { generateMasterScript, generateScript } from '@/lib/muse/spark';
import { routeError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const { key, baseUrl } = await byokHeaders(req);
    const body = await req.json();
    // mode: 'master' drafts the final narrative on the Business page;
    // default organizes the approved master into timed scenes.
    if (body?.mode === 'master') {
      const masterScript = await generateMasterScript({ key, baseUrl, ...body });
      return NextResponse.json({ masterScript });
    }
    const script = await generateScript({ key, baseUrl, ...body });
    return NextResponse.json({ script });
  } catch (e: any) {
    return NextResponse.json({ error: routeError(e, 'Script failed — please try again.') }, { status: 400 });
  }
}
