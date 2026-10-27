import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';
import { generateScript } from '@/lib/muse/spark';

export async function POST(req: NextRequest) {
  try {
    let key = '', baseUrl = '';
    try { ({ key, baseUrl } = byokHeaders(req)); } catch { key = 'DEMO'; baseUrl = ''; }
    const body = await req.json();
    const script = await generateScript({ key, baseUrl, ...body });
    return NextResponse.json({ script });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Script failed.' }, { status: 500 });
  }
}
