import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { GPX_ERROR_MESSAGES, GPX_MAX_BYTES, parseGpx, type GpxError } from './gpx';
import type { ImportedWorkout } from './imported-workout';

export type GpxPickResult =
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; workout: ImportedWorkout; name: string | null };

/**
 * Escolhe um .gpx no aparelho e devolve o treino. O tamanho é conferido antes de ler: arquivo grande não
 * chega à memória. O conteúdo só é lido e resumido aqui; o trajeto não é enviado a lugar nenhum.
 */
export async function pickGpxWorkout(): Promise<GpxPickResult> {
  const picked = await getDocumentAsync({
    // Muitos gerenciadores de arquivo não conhecem o tipo do GPX; o conteúdo é validado na leitura.
    type: ['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || picked.assets.length === 0) return { kind: 'cancelled' };
  const asset = picked.assets[0];
  if (typeof asset.size === 'number' && asset.size > GPX_MAX_BYTES) {
    return { kind: 'error', message: GPX_ERROR_MESSAGES.too_large };
  }

  let text: string;
  try {
    if (Platform.OS === 'web') {
      if (!asset.file) return { kind: 'error', message: GPX_ERROR_MESSAGES.not_gpx };
      if (asset.file.size > GPX_MAX_BYTES) return { kind: 'error', message: GPX_ERROR_MESSAGES.too_large };
      text = await asset.file.text();
    } else {
      const file = new File(asset.uri);
      if (typeof file.size === 'number' && file.size > GPX_MAX_BYTES) {
        return { kind: 'error', message: GPX_ERROR_MESSAGES.too_large };
      }
      text = await file.text();
    }
  } catch {
    return { kind: 'error', message: 'Não foi possível ler o arquivo. Tente exportar de novo.' };
  }

  const parsed = parseGpx(text);
  if (!parsed.ok) return { kind: 'error', message: GPX_ERROR_MESSAGES[parsed.error satisfies GpxError] };
  const { summary } = parsed;
  return {
    kind: 'ok',
    name: summary.name,
    workout: {
      source: 'gpx',
      sourceId: summary.fingerprint,
      origin: null,
      suggestedType: summary.suggestedTypeFromFile,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      distanceM: summary.distanceM > 0 ? summary.distanceM : null,
      avgHeartRate: summary.avgHeartRate,
      maxHeartRate: summary.maxHeartRate,
    },
  };
}
