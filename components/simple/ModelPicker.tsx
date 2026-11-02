'use client';
import { useEffect, useState } from 'react';
import { MODEL_ROWS, SPARK_MODELS, estimateScriptCost, fmtUSD, type SparkModelId } from '@/config/pricing';
import { useProject } from '@/stores/projectStore';
import { usePrefs } from '@/stores/preferences';
import { useKeyStore } from '@/stores/keyStore';
import { JUDGING_BUILD, isJudgingView } from '@/lib/judging';

export default function ModelPicker({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { sparkModel, durationSec, set } = useProject();
  const { lastWriter, setLastWriter } = usePrefs();
  const { modelStatus } = useKeyStore();
  const [judgeMsg, setJudgeMsg] = useState('');
  // Judging view (not just the build flag): Contributor is the judging
  // default and Standard is dimmed. The BYOK preview inside a judging build
  // behaves like pure BYOK (both pickable). Pure BYOK builds: always BYOK.
  const JUDGING = JUDGING_BUILD && isJudgingView();

  // Judging view: Contributor is the default. Force it on arrival so a stale
  // "last writer = standard" from localStorage can't leak into judging runs.
  useEffect(() => {
    if (JUDGING && sparkModel !== 'spark-contributor') {
      set({ sparkModel: 'spark-contributor' });
      setLastWriter('spark-contributor');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (m: SparkModelId) => { set({ sparkModel: m }); setLastWriter(m); };

  const handlePick = (m: SparkModelId) => {
    if (JUDGING && m === 'spark-standard') {
      setJudgeMsg('Muse Spark 1.3 Contributor is the default in judging mode — Standard is turned off to keep judging runs consistent. Continue with Contributor.');
      return;
    }
    setJudgeMsg('');
    pick(m);
  };

  return (
    <div className="card space-y-4">
      <p className="meta-eyebrow">Writer</p>
      <h2 className="font-semibold tracking-tight text-[22px] leading-tight">Who should write your commercial?</h2>
      <p className="text-[15px] text-muted">Your last choice is pre-selected{lastWriter ? ` (${SPARK_MODELS[lastWriter].label})` : ''}. You can change this for every new commercial.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-line rounded-2xl overflow-hidden bg-white">
          <thead>
            <tr className="bg-[#f2f1ed] text-left">
              <th className="p-3 font-semibold">Feature / Dimension</th>
              <th className="p-3 font-semibold">Muse Spark 1.3 (Standard)</th>
              <th className="p-3 font-semibold">Muse Spark 1.3 Contributor</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_ROWS.map((r) => (
              <tr key={r.feature} className="border-t">
                <td className="p-3 font-medium">{r.feature}</td>
                <td className="p-3">{r.standard}</td>
                <td className="p-3">{r.contributor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[15px] bg-[#f2f1ed] border border-line rounded-2xl p-4">
        Example: a typical {durationSec}-second script costs about {fmtUSD(estimateScriptCost('spark-standard', durationSec))} with Standard vs about {fmtUSD(estimateScriptCost('spark-contributor', durationSec))} with Contributor. Your key is charged by the provider directly.
      </p>
      <p className="text-[14px] text-muted">Standard: your business content is not used for model training. Contributor: provider may use prompts &amp; completions.</p>
      {JUDGING && (
        <p className="text-sm bg-green-50 border border-green-200 text-green-800 rounded-xl p-3">
          Judging default: Muse Spark 1.3 Contributor — picked for you. Standard is dimmed so every judging run stays consistent.
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {(Object.keys(SPARK_MODELS) as SparkModelId[]).map((id) => {
          const failed = modelStatus[id] === 'fail';
          const judgedOff = JUDGING && id === 'spark-standard';
          const disabled = failed || judgedOff;
          const selected = sparkModel === id;
          return (
            <button key={id} disabled={failed} onClick={() => handlePick(id)} aria-disabled={disabled}
              className={`text-left border-2 rounded-2xl p-4 ${selected ? 'border-black bg-neutral-50' : 'border-neutral-200 bg-white'} ${failed ? 'opacity-50' : judgedOff ? 'opacity-40 saturate-0 cursor-not-allowed hover:border-neutral-200' : 'hover:border-black'}`}>
              <div className="flex items-center gap-2 font-semibold">
                <span aria-hidden>{selected ? '(•)' : '( )'}</span> {SPARK_MODELS[id].label}
                {JUDGING && id === 'spark-contributor' && <span className="badge !bg-green-100 !text-green-800 ml-1">Judging default</span>}
                {judgedOff && <span className="badge ml-1">Dimmed in judging</span>}
              </div>
              {lastWriter === id && !JUDGING && <span className="badge mt-2">✓ Your last choice</span>}
              {failed && <p className="text-xs mt-2">Your key doesn&apos;t include this one — no problem, the other works great.</p>}
            </button>
          );
        })}
      </div>
      {judgeMsg && <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3">{judgeMsg}</p>}
      <div className={`flex items-center ${onBack ? 'justify-between' : 'justify-end'}`}>{onBack && <button className="btn-secondary" onClick={onBack}>← Back</button>}<button className="btn-primary" onClick={onDone}>Continue →</button></div>
    </div>
  );
}
