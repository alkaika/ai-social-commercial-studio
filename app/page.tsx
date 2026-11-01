'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { BUILD_VIEW_KEY, JUDGING_BUILD, getStoredBuildView, setStoredBuildView, type BuildView } from '@/lib/judging';

function HomeInner() {
  const params = useSearchParams();
  const [view, setView] = useState<BuildView>(JUDGING_BUILD ? 'judging' : 'byok');

  // Landing runtime toggle (judging builds only):
  // - default = judging view ("Start judging run →" + "Switch to BYOK build")
  // - ?build=byok deep-links the BYOK preview; otherwise restore last toggle
  // - "Switch to BYOK build" → BYOK view ("Start run →" + demo link + "Switch to Judging build")
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
    <main className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Make a commercial in under 5 minutes</h1>
        {JUDGING ? (
          <p className="text-lg text-neutral-600">Judging build — every AI step is live, no key needed. Pick a writer and go.</p>
        ) : (
          <p className="text-lg text-neutral-600">No editing experience needed. No monthly subscription. Bring your own Meta key — you pay Meta directly, only for what you generate.</p>
        )}
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href={JUDGING ? '/studio' : '/studio?build=byok'} className="btn-primary">{JUDGING ? 'Start judging run →' : JUDGING_BUILD ? 'Start run →' : 'Start my commercial →'}</Link>
          {JUDGING ? (
            <button className="btn-secondary" onClick={() => switchView('byok')}>Switch to BYOK build</button>
          ) : (
            <>
              <Link href="/studio?demo=1" className="btn-secondary">Try the demo (no key needed)</Link>
              {JUDGING_BUILD && <button className="btn-secondary" onClick={() => switchView('judging')}>Switch to Judging build</button>}
            </>
          )}
        </div>
      </div>
      <div className="card space-y-2">
        <h2 className="font-semibold text-lg">How it works</h2>
        <ol className="list-decimal ml-5 space-y-1 text-neutral-700">
          {JUDGING ? (
            <>
              <li>✍️ Pick your writer — see exact costs + data rights, no jargon</li>
              <li>🏢 Add your website, photos, or pasted text</li>
              <li>✨ Press Generate — preview, edit, or just tell the AI what to change</li>
              <li>📤 Export for TikTok, Reels, Shorts, Instagram, YouTube, Facebook, X & LinkedIn</li>
            </>
          ) : (
            <>
              <li>🔑 Connect your Meta key (checked once, optionally saved with Face ID / Windows Hello)</li>
              <li>✍️ Pick your writer — see exact costs + data rights, no jargon</li>
              <li>🏢 Add your website, photos, or pasted text</li>
              <li>✨ Press Generate — preview, edit, or just tell the AI what to change</li>
              <li>📤 Export for TikTok, Reels, Shorts, Instagram, YouTube, Facebook, X & LinkedIn</li>
            </>
          )}
        </ol>
      </div>
      {!JUDGING && (
        <div className="card">
          <h2 className="font-semibold">Why BYOK?</h2>
          <p className="text-neutral-700">This studio is free to use. Your Meta key is like a password that lets the app use Meta&apos;s AI. It is encrypted on your device, sent only with your own requests over HTTPS, and never stored on our server.</p>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="p-8 text-center">Loading…</main>}>
      <HomeInner />
    </Suspense>
  );
}
