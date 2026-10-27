'use client';
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

const STEPS: { id: Step; label: string }[] = [
  { id: 'key', label: 'Key' },
  { id: 'writer', label: 'Writer' },
  { id: 'sources', label: 'Business' },
  { id: 'brand', label: 'Style' },
  { id: 'configure', label: 'Setup' },
  { id: 'script', label: 'Story' },
  { id: 'review', label: 'Review' },
  { id: 'export', label: 'Export' },
];

function StudioInner() {
  const { step, set } = useProject();
  const { setKey } = useKeyStore();
  const params = useSearchParams();

  useEffect(() => {
    if (params.get('demo') === '1') {
      setKey('DEMO', '');
      set({ step: 'writer' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idx = STEPS.findIndex((s) => s.id === step);
  const go = (s: Step) => set({ step: s });

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {STEPS.map((s, i) => (
          <span key={s.id} className="flex items-center gap-2">
            <span className={`badge ${i <= idx ? '!bg-black !text-white' : ''}`}>{i + 1}. {s.label}</span>
            {i < STEPS.length - 1 && <span className="text-neutral-300">→</span>}
          </span>
        ))}
      </div>
      {step === 'key' && <KeySetup onDone={() => go('writer')} />}
      {step === 'writer' && <ModelPicker onDone={() => go('sources')} />}
      {step === 'sources' && <SourceHub onDone={() => go('configure')} />}
      {step === 'brand' && <SourceHub onDone={() => go('configure')} />}
      {step === 'configure' && <ConfigureStep onDone={() => go('script')} />}
      {step === 'script' && <Storyboard onDone={() => go('export')} />}
      {step === 'review' && <Storyboard onDone={() => go('export')} />}
      {step === 'export' && <ExportStep />}
      <p className="text-center text-xs text-neutral-500">✓ Saved just now · Your key stays in this tab · Free platform — you pay Meta directly</p>
    </main>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center">Loading studio…</main>}>
      <StudioInner />
    </Suspense>
  );
}
