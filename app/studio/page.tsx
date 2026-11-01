'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
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
import { JUDGING_MODE, SERVER_KEY_PLACEHOLDER } from '@/lib/judging';

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

  // Judging mode: host's server key (META_API_KEY, server-only) powers all
  // AI. Skip the Key step entirely — judges never paste anything.
  // After judging: delete META_API_KEY + NEXT_PUBLIC_JUDGING_MODE and
  // redeploy to return to pure BYOK.
  const STEPS = JUDGING_MODE ? ALL_STEPS.filter((s) => s.id !== 'key') : ALL_STEPS;

  useEffect(() => {
    if (JUDGING_MODE) {
      if (!key || key === 'DEMO') setKey(SERVER_KEY_PLACEHOLDER, '');
      if ((useProject.getState().step as string) === 'key') set({ step: 'writer' });
      return;
    }
    if (params.get('demo') === '1') {
      setKey('DEMO', '');
      set({ step: 'writer' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idx = Math.max(0, STEPS.findIndex((s) => s.id === step));
  const go = (s: Step) => {
    // Guard: never land on the hidden Key step while judging.
    if (JUDGING_MODE && s === 'key') { set({ step: 'writer' }); return; }
    set({ step: s });
  };

  // Flow: Key → Writer → Setup → Business → Story → Review → Export.
  // ('brand' renders the same SourceHub as 'sources'; kept as an alias.)
  const PREV: Partial<Record<Step, Step>> = JUDGING_MODE
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
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link href="/" className="btn-secondary">← Back to home</Link>
      </div>
      {JUDGING_MODE && (
        <p className="text-xs text-center bg-green-50 border border-green-200 text-green-800 rounded-xl p-2">
          Judging mode — powered by the host key. No key needed.
        </p>
      )}
      <ProjectBar />
      <div className="flex items-center gap-2 text-sm flex-wrap" role="navigation" aria-label="Studio steps">
        {STEPS.map((s, i) => (
          <span key={s.id} className="flex items-center gap-2">
            {i <= idx ? (
              <button onClick={() => go(s.id)} className={`badge hover:opacity-70 ${i === idx ? '!bg-black !text-white' : 'underline'}`} title={`Go back to ${s.label}`}>
                {i + 1}. {s.label}{i < idx ? ' ✓' : ''}
              </button>
            ) : (
              <span className="badge opacity-50">{i + 1}. {s.label}</span>
            )}
            {i < STEPS.length - 1 && <span className="text-neutral-300">→</span>}
          </span>
        ))}
      </div>
      {!JUDGING_MODE && step === 'key' && <KeySetup onDone={() => go('writer')} />}
      {step === 'writer' && <ModelPicker onDone={() => go('configure')} onBack={JUDGING_MODE ? undefined : goBack} />}
      {step === 'configure' && <ConfigureStep onDone={() => go('sources')} onBack={goBack} />}
      {step === 'sources' && <SourceHub onDone={() => go('script')} onBack={goBack} />}
      {step === 'brand' && <SourceHub onDone={() => go('script')} onBack={goBack} />}
      {step === 'script' && <Storyboard onDone={() => go('export')} onBack={goBack} />}
      {step === 'review' && <Storyboard onDone={() => go('export')} onBack={goBack} />}
      {step === 'export' && <ExportStep onBack={goBack} />}
      <p className="text-center text-xs text-neutral-500">{JUDGING_MODE ? 'Judging build — host key covers all AI usage' : 'Your key stays in this tab · Free platform — you pay Meta directly'}</p>
    </main>
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
