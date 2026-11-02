'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useProject, type Step } from '@/stores/projectStore';
import { useKeyStore } from '@/stores/keyStore';
import KeySetup from '@/components/simple/KeySetup';
import ModelPicker from '@/components/simple/ModelPicker';
import SourceHub from '@/components/source/SourceHub';
import ConfigureStep from '@/components/simple/ConfigureStep';
import Storyboard from '@/components/simple/Storyboard';
import ExportStep from '@/components/simple/ExportStep';
import PersistGate from '@/components/project/PersistGate';
import ProjectBar from '@/components/project/ProjectBar';
import { JUDGING_BUILD, SERVER_KEY_PLACEHOLDER, getStoredBuildView, setStoredBuildView, type BuildView } from '@/lib/judging';

const ALL_STEPS: { id: Step; label: string }[] = [
  { id: 'key', label: 'Key' },
  { id: 'writer', label: 'Writer' },
  { id: 'configure', label: 'Setup' },
  { id: 'sources', label: 'Business' },
  { id: 'brand', label: 'Style' },
  { id: 'script', label: 'Story' },
  { id: 'review', label: 'Review' },
  { id: 'export', label: 'Export' },
];

function StudioInner() {
  const { step, set } = useProject();
  const { key, setKey } = useKeyStore() as any;
  const params = useSearchParams();
  const [view, setView] = useState<BuildView | null>(null);

  // Landing runtime toggle (judging builds only): ?build=byok or the stored
  // toggle shows the BYOK flow (Key step) so you can preview post-judging.
  // Default + every other entry = judging flow (Key hidden, host key).
  // Pure BYOK builds (flag off) always run BYOK — no toggle to read.
  // view=null on first render = match SSR (judging default) to avoid
  // hydration mismatch; the effect below corrects to the stored preview.
  useEffect(() => {
    if (!JUDGING_BUILD) { setView('byok'); return; }
    const q = params.get('build');
    if (q === 'byok' || q === 'judging') {
      setView(q);
      setStoredBuildView(q);
      return;
    }
    setView(getStoredBuildView() ?? 'judging');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewByok = JUDGING_BUILD && view === 'byok';
  const JUDGING = JUDGING_BUILD && view !== 'byok';

  // Judging mode: host's server key (META_API_KEY, server-only) powers all
  // AI. Skip the Key step entirely — judges never paste anything.
  // After judging: delete META_API_KEY + NEXT_PUBLIC_JUDGING_MODE and
  // redeploy to return to pure BYOK.
  const STEPS = JUDGING ? ALL_STEPS.filter((s) => s.id !== 'key') : ALL_STEPS;

  useEffect(() => {
    if (view === null) return; // wait until the runtime view resolves
    if (previewByok) setStoredBuildView('byok');
    if (JUDGING) {
      if (!key || key === 'DEMO') setKey(SERVER_KEY_PLACEHOLDER, '');
      if ((useProject.getState().step as string) === 'key') set({ step: 'writer' });
      return;
    }
    if (params.get('demo') === '1') {
      setKey('DEMO', '');
      set({ step: 'writer' });
    } else if ((useProject.getState().step as string) === 'writer') {
      // Entering the BYOK preview while the store still boots at Writer
      // (judging default) — correct back to the Key step.
      set({ step: 'key' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const idx = Math.max(0, STEPS.findIndex((s) => s.id === step));
  const go = (s: Step) => {
    // Guard: never land on the hidden Key step while judging.
    if (JUDGING && s === 'key') { set({ step: 'writer' }); return; }
    set({ step: s });
  };

  // Flow: Key → Writer → Setup → Business → Story → Review → Export.
  // ('brand' renders the same SourceHub as 'sources'; kept as an alias.)
  const PREV: Partial<Record<Step, Step>> = JUDGING
    ? {
        configure: 'writer',
        sources: 'configure',
        brand: 'sources',
        script: 'sources',
        review: 'script',
        export: 'script',
      }
    : {
        writer: 'key',
        configure: 'writer',
        sources: 'configure',
        brand: 'sources',
        script: 'sources',
        review: 'script',
        export: 'script',
      };

  const goBack = () => {
    const prev = PREV[step];
    if (prev) go(prev);
  };

  return (
    <div className="meta-shell">
      <header className="meta-topbar">
        <div className="meta-column px-5 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="btn-secondary !py-2">← Home</Link>
          <span className="font-semibold tracking-tight text-[15px]">Studio</span>
          <span className="badge">{JUDGING ? 'Judging · host key' : 'BYOK'}</span>
        </div>
        <div className="meta-column px-5 pb-3">
          <div className="meta-step-pills flex items-center gap-2 text-sm overflow-x-auto pb-1" role="navigation" aria-label="Studio steps">
            {STEPS.map((s, i) => (
              <span key={s.id} className="flex items-center gap-2 shrink-0">
                {i <= idx ? (
                  <button onClick={() => go(s.id)} className={`badge hover:opacity-70 ${i === idx ? '!bg-ink !text-white' : ''}`} title={`Go back to ${s.label}`}>
                    {i + 1}. {s.label}{i < idx ? ' ✓' : ''}
                  </button>
                ) : (
                  <span className="badge opacity-50">{i + 1}. {s.label}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </header>
      <main className="meta-column px-5 pt-8 pb-16 space-y-6">
      {JUDGING && (
        <p className="text-[13px] text-center bg-white border border-line text-muted rounded-full px-4 py-2">
          Judging mode — powered by the host key. No key needed.
        </p>
      )}
      <ProjectBar />
      {!JUDGING && step === 'key' && <KeySetup onDone={() => go('writer')} />}
      {step === 'writer' && <ModelPicker onDone={() => go('configure')} onBack={JUDGING ? undefined : goBack} />}
      {step === 'configure' && <ConfigureStep onDone={() => go('sources')} onBack={goBack} />}
      {step === 'sources' && <SourceHub onDone={() => go('script')} onBack={goBack} />}
      {step === 'brand' && <SourceHub onDone={() => go('script')} onBack={goBack} />}
      {step === 'script' && <Storyboard onDone={() => go('export')} onBack={goBack} />}
      {step === 'review' && <Storyboard onDone={() => go('export')} onBack={goBack} />}
      {step === 'export' && <ExportStep onBack={goBack} />}
      <p className="text-center text-[13px] text-muted">{JUDGING ? 'Judging build — host key covers all AI usage' : 'Your key stays in this tab · Free studio — you pay the provider directly'}</p>
      </main>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center">Loading studio…</main>}>
      <PersistGate />
      <StudioInner />
    </Suspense>
  );
}
