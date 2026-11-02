import { NextRequest, NextResponse } from 'next/server';
import { byokHeaders, callMuse } from '@/lib/muse/client';
import { endpointModelForSpark } from '@/lib/muse/models.config';

// Director's Notes -> structured EditPlan (locked/pinned/duration enforced later)
export async function POST(req: NextRequest) {
  try {
    const { key, baseUrl } = byokHeaders(req);
    const { script, instruction, sparkModel } = await req.json();
    if (!instruction?.trim()) return NextResponse.json({ error: 'Tell us what to change first.' }, { status: 400 });
    const data: any = await callMuse({
      key, baseUrl, path: '/v1/chat/completions',
      body: {
        model: endpointModelForSpark(sparkModel || 'spark-contributor'),
        messages: [{ role: 'user', content: `Given scenes JSON ${JSON.stringify(script?.scenes?.map((s: any) => ({ id: s.id, heading: s.heading, voiceover: s.voiceover, locked: !!s.locked })))} and user note "${instruction}", return STRICT JSON {"summary":"...","steps":[{"action":"rewrite|new-voice|new-image|animate","sceneIds":["s1"],"detail":"..."}],"targets":["s1"]}. Never target locked scenes.` }],
      },
    });
    const text: string = data?.choices?.[0]?.message?.content ?? '{}';
    const plan = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return NextResponse.json({ plan: { ...plan, estCost: 0.01 } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Revision planning failed.' }, { status: 400 });
  }
}
