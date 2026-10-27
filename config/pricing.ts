// Single source of truth for Muse pricing + factual writer comparison.
// User-supplied table — rendered verbatim, never paraphrased.
export type SparkModelId = 'spark-standard' | 'spark-contributor';

export const SPARK_MODELS: Record<
  SparkModelId,
  {
    id: SparkModelId;
    label: string;
    endpointModel: string; // model id sent to the Meta gateway
    inputPerMTok: number;
    outputPerMTok: number;
    dataRights: string;
  }
> = {
  'spark-standard': {
    id: 'spark-standard',
    label: 'Muse Spark 1.3 (Standard)',
    endpointModel: 'muse-spark-1.3',
    inputPerMTok: 1.25,
    outputPerMTok: 4.25,
    dataRights: 'No data use for model training',
  },
  'spark-contributor': {
    id: 'spark-contributor',
    label: 'Muse Spark 1.3 Contributor',
    endpointModel: 'muse-spark-1.3-contributor',
    inputPerMTok: 0.1,
    outputPerMTok: 0.2,
    dataRights: 'Meta may use prompts & completions',
  },
};

export const MODEL_ROWS: { feature: string; standard: string; contributor: string }[] = [
  { feature: 'Input Token Cost', standard: '$1.25 / million tokens', contributor: '$0.10 / million tokens' },
  { feature: 'Output Token Cost', standard: '$4.25 / million tokens', contributor: '$0.20 / million tokens' },
  { feature: 'Data Training Rights', standard: 'No data use for model training', contributor: 'Meta may use prompts & completions' },
];

/** Rough per-script cost estimate. ~1.6k input + ~0.9k output tokens per 15s script. */
export function estimateScriptCost(model: SparkModelId, durationSec: number) {
  const m = SPARK_MODELS[model];
  const scale = durationSec / 15;
  const inTok = 1600 * scale;
  const outTok = 900 * scale;
  return (inTok / 1e6) * m.inputPerMTok + (outTok / 1e6) * m.outputPerMTok;
}

export const fmtUSD = (n: number) =>
  n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
