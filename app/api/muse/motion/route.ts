import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders } from '@/lib/muse/client';

export async function POST(req: NextRequest) {
  // Retired: Wonder was never a video model and all reasoning now runs on
  // the user's chosen Spark writer. Motion = uploaded meta.ai clips or
  // Ken Burns (see resolveMotionTier). Keep the route (200, not 404) so old
  // clients degrade gracefully.
  try { byokHeaders(req); } catch {}
  return NextResponse.json({ videoUrl: '', mock: true, fallback: 'kenburns' as const, retired: 'wonder-replaced-by-spark' as const });
}
