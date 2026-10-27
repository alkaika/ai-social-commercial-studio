import { SPARK_MODELS, type SparkModelId } from '@/config/pricing';

export const GATEWAY_MODELS = {
  sparkStandard: 'muse-spark-1.3',
  sparkContributor: 'muse-spark-1.3-contributor',
  wonder: 'muse-wonder-1.0',
  sam: 'sam-3.1',
  voice: 'muse-voice-transcribe-1.0',
  image: 'muse-image-1.0',
} as const;

export function endpointModelForSpark(id: SparkModelId) {
  return SPARK_MODELS[id].endpointModel;
}
