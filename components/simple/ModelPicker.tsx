'use client';
import { MODEL_ROWS, SPARK_MODELS, estimateScriptCost, fmtUSD, type SparkModelId } from '@/config/pricing';
import { useProject } from '@/stores/projectStore';
import { usePrefs } from '@/stores/preferences';
import { useKeyStore } from '@/stores/keyStore';

export default function ModelPicker({ onDone }: { onDone: () => void }) {
  const { sparkModel, durationSec, set } = useProject();
  const { lastWriter, setLastWriter } = usePrefs();
  const { modelStatus } = useKeyStore();

  const pick = (m: SparkModelId) => { set({ sparkModel: m }); setLastWriter(m); };

  return (
    <div className="card space-y-4">
      <h2 className="text-xl font-bold">✍️ Who should write your commercial?</h2>
      <p className="text-sm text-neutral-600">Your last choice is pre-selected{lastWriter ? ` (${SPARK_MODELS[lastWriter].label})` : ''}. You can change this for every new commercial.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-neutral-100 text-left">
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
      <p className="text-sm bg-neutral-100 border rounded-xl p-3">
        Example: a typical {durationSec}-second script costs about {fmtUSD(estimateScriptCost('spark-standard', durationSec))} with Standard vs about {fmtUSD(estimateScriptCost('spark-contributor', durationSec))} with Contributor. Your key is charged by Meta directly.
      </p>
      <p className="text-sm text-neutral-600">Standard: your business content is not used for model training. Contributor: Meta may use prompts &amp; completions.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {(Object.keys(SPARK_MODELS) as SparkModelId[]).map((id) => {
          const disabled = modelStatus[id] === 'fail';
          const selected = sparkModel === id;
          return (
            <button key={id} disabled={disabled} onClick={() => pick(id)}
              className={`text-left border-2 rounded-2xl p-4 ${selected ? 'border-black bg-neutral-50' : 'border-neutral-200 bg-white'} ${disabled ? 'opacity-50' : 'hover:border-black'}`}>
              <div className="flex items-center gap-2 font-semibold">
                <span aria-hidden>{selected ? '(•)' : '( )'}</span> {SPARK_MODELS[id].label}
              </div>
              {lastWriter === id && <span className="badge mt-2">✓ Your last choice</span>}
              {disabled && <p className="text-xs mt-2">Your key doesn&apos;t include this one — no problem, the other works great.</p>}
            </button>
          );
        })}
      </div>
      <div className="text-right"><button className="btn-primary" onClick={onDone}>Continue →</button></div>
    </div>
  );
}
