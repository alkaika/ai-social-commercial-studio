import { NextRequest, NextResponse } from 'next/server';
import { scrapeUrl } from '@/lib/scraper';
import { PublicError, routeError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json();
    const list: string[] = Array.isArray(urls) ? urls : [];
    if (!list.length) return NextResponse.json({ error: 'Add at least one website address.' }, { status: 400 });
    const results = [];
    for (const u of list.slice(0, 5)) {
      try { results.push({ url: u, ok: true, data: await scrapeUrl(u) }); }
      catch (e: any) { results.push({ url: u, ok: false, error: e instanceof PublicError ? e.message : 'Could not read this site.' }); }
    }
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: routeError(e, 'Scrape failed — please try again.') }, { status: 500 });
  }
}
