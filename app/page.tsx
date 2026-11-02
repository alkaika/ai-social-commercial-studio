'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { JUDGING_BUILD, getStoredBuildView, setStoredBuildView, type BuildView } from '@/lib/judging';

function HomeInner() {
  const params = useSearchParams();
  const [view, setView] = useState<BuildView>(JUDGING_BUILD ? 'judging' : 'byok');
  const [infoTab, setInfoTab] = useState<'how' | 'workflow'>('workflow');

  // Landing runtime toggle (judging builds only):
  // - default = judging view ("Start judging run →" + "Switch to BYOK build")
  // - ?build=byok deep-links the BYOK preview; otherwise restore last toggle
  // - "Switch to BYOK build" → BYOK view ("Start run →" + "Switch to Judging build")
  // - "Switch to Judging build" → back to judging view
  // Pure BYOK builds (flag off) always render BYOK, no toggle.
  // No secrets involved — this only swaps landing/studio copy + flow.
  useEffect(() => {
    if (!JUDGING_BUILD) return;
    const q = params.get('build');
    if (q === 'byok' || q === 'judging') {
      setView(q);
      setStoredBuildView(q);
      return;
    }
    const stored = getStoredBuildView();
    if (stored) setView(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchView = (v: BuildView) => {
    setView(v);
    setStoredBuildView(v);
    try {
      const url = new URL(window.location.href);
      if (v === 'byok') url.searchParams.set('build', 'byok');
      else url.searchParams.delete('build');
      window.history.replaceState(null, '', url.toString());
    } catch { /* ignore */ }
  };

  const JUDGING = JUDGING_BUILD && view === 'judging';

  return (
    <div className="meta-shell">
      <main className="meta-column px-5 pt-14 pb-16 space-y-10">
      <div className="text-center space-y-4">
        <p className="text-[16px] font-bold uppercase tracking-[0.08em] text-muted">SOCIAL MEDIA COMMERCIAL STUDIO</p>
        <h1 className="meta-greeting">Make a commercial <span>in under 5 minutes</span></h1>
        {JUDGING ? (
          <p className="meta-sub max-w-xl mx-auto">Judging build — every AI step is live, no key needed. Pick a writer and go.</p>
        ) : (
          <p className="meta-sub max-w-xl mx-auto">No editing experience needed. No monthly subscription. Bring your own key — you pay the provider directly, only for what you generate.</p>
        )}
        <div className="meta-composer p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2 justify-center items-stretch">
            <Link href={JUDGING ? '/studio' : '/studio?build=byok'} className="btn-primary flex-1 sm:flex-none sm:min-w-[220px]">{JUDGING ? 'Start judging run' : JUDGING_BUILD ? 'Start run' : 'Start my commercial'}</Link>
            {JUDGING ? (
              <button className="btn-secondary flex-1 sm:flex-none" onClick={() => switchView('byok')}>Switch to BYOK build</button>
            ) : (
              JUDGING_BUILD && <button className="btn-secondary flex-1 sm:flex-none" onClick={() => switchView('judging')}>Switch to Judging build</button>
            )}
          </div>
          <p className="text-center text-[13px] text-muted mt-3">{JUDGING ? 'Judging mode is powered by the host key. No API key needed.' : JUDGING_BUILD ? 'Add your API key on the next page' : 'Free studio · your key stays in this tab · export for every platform'}</p>
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        <button className={`border-2 rounded-full px-4 py-2 ${infoTab === 'how' ? 'border-black bg-neutral-100 font-semibold' : 'border-neutral-200'}`} onClick={() => setInfoTab('how')}>HOW THE APP WORKS</button>
        <button className={`border-2 rounded-full px-4 py-2 ${infoTab === 'workflow' ? 'border-black bg-neutral-100 font-semibold' : 'border-neutral-200'}`} onClick={() => setInfoTab('workflow')}>WORKFLOW STEPS</button>
      </div>
      {infoTab === 'workflow' ? (
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="meta-tile">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">01 · Key</p>
          <p className="font-semibold text-[17px] leading-snug">Connect your key</p>
          <p className="text-[14.5px] text-muted mt-1 leading-relaxed">Checked once, optionally saved with biometrics. Encrypted on your device.</p>
        </div>
        <div className="meta-tile">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">02 · Script writer</p>
          <p className="font-semibold text-[17px] leading-snug">Choose Muse Spark 1.3 Standard or Contributor</p>
          <p className="text-[14.5px] text-muted mt-1 leading-relaxed">Compare input/output costs and data training rights.</p>
        </div>
        <div className="meta-tile">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">03 · Choose Platform & Settings</p>
          <p className="font-semibold text-[17px] leading-snug">Instagram, Facebook, TikTok, X, YouTube Shorts, YouTube Video</p>
          <p className="text-[14.5px] text-muted mt-1 leading-relaxed">Select 10s, 20s, 30s, or 60s timeframe and vibe.</p>
        </div>
        <div className="meta-tile">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">04 · Add company details</p>
          <p className="font-semibold text-[17px] leading-snug">Add website</p>
          <p className="text-[14.5px] text-muted mt-1 leading-relaxed">AI model analyzes the website, compiles screenshots, and drafts the script. User reviews, edits (if needed), and finalizes the script.</p>
        </div>
        <div className="meta-tile">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">05 · Choose your preferences</p>
          <p className="font-semibold text-[17px] leading-snug">🧍 People + app (Meta.ai), 🎙 Voices + screenshots only (Meta.ai), 🎧 Voice MP3 (Meta.ai) + Ken Burns in app</p>
          <p className="text-[14.5px] text-muted mt-1 leading-relaxed">AI model drafts your 10-second part prompts to use on Meta.ai. Meta.ai generates your commercial. Download completed file.</p>
        </div>
        <div className="meta-tile">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">06 · Stitch files if needed</p>
          <p className="font-semibold text-[17px] leading-snug">Use the Stitch feature as a fallback</p>
          <p className="text-[14.5px] text-muted mt-1 leading-relaxed">Our Stitch feature is available if Meta.ai has issues stitching your files.</p>
        </div>
      </div>
      ) : (
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="meta-tile">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">Paste → Prompt</p>
          <p className="font-semibold text-[17px] leading-snug">How the app works (coming soon)</p>
          <p className="text-[14.5px] text-muted mt-1 leading-relaxed">Mock content — real explainer text goes here.</p>
        </div>
        <div className="meta-tile">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1">Generate → Share</p>
          <p className="font-semibold text-[17px] leading-snug">How the app works (coming soon)</p>
          <p className="text-[14.5px] text-muted mt-1 leading-relaxed">Mock content — real explainer text goes here.</p>
        </div>
      </div>
      )}
      {!JUDGING && (
        <div className="card">
          <h2 className="font-semibold text-[18px] tracking-tight">Why do you need an API key?</h2>
          <p className="text-muted text-[15px] mt-2 leading-relaxed">Your key grants access to Meta's AI model to power the app's core features. It is encrypted on your device, sent only with your own requests over HTTPS, and never stored on our server.</p>
        </div>
      )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="p-8 text-center">Loading…</main>}>
      <HomeInner />
    </Suspense>
  );
}
