import { haversineMeters, type RoutePoint } from './route';

/** Leitura do GPS: posição, precisão em metros (quando o aparelho informa) e instante em ms. */
export type Fix = RoutePoint & { accuracy: number | null; at: number };

/** Pior precisão aceita: acima disso o ponto mais atrapalha que ajuda. */
export const MAX_ACCURACY_M = 25;
/** Parado ou tremendo no lugar não soma distância. */
export const MIN_STEP_M = 5;
/** Acima de 25 m/s (90 km/h) não é corrida nem bike: é salto do sinal. */
export const MAX_SPEED_MS = 25;
/** Teto de pontos guardados na memória numa sessão (mais de 6 h com um ponto a cada 5 s). */
export const MAX_TRACK_POINTS = 5000;

export type Track = { points: Fix[]; distanceM: number };

export const EMPTY_TRACK: Track = { points: [], distanceM: 0 };

/**
 * Soma um ponto ao percurso, ou o recusa: precisão ruim, passo curto demais ou salto impossível.
 * A distância é a soma dos trechos aceitos, calculada no aparelho.
 */
export function addFix(track: Track, fix: Fix): Track {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || Math.abs(fix.lat) > 90 || Math.abs(fix.lng) > 180) return track;
  if (fix.accuracy !== null && (!Number.isFinite(fix.accuracy) || fix.accuracy > MAX_ACCURACY_M)) return track;
  if (track.points.length >= MAX_TRACK_POINTS) return track;

  const last = track.points[track.points.length - 1];
  if (!last) return { points: [fix], distanceM: 0 };

  const step = haversineMeters(last, fix);
  if (step < MIN_STEP_M) return track;
  const seconds = (fix.at - last.at) / 1000;
  if (seconds <= 0 || step / seconds > MAX_SPEED_MS) return track;

  return { points: [...track.points, fix], distanceM: track.distanceM + step };
}

/** Qualidade do sinal pela precisão da última leitura, para a pessoa saber se pode confiar. */
export function signalQuality(accuracy: number | null): 'bom' | 'fraco' | 'desconhecido' {
  if (accuracy === null || !Number.isFinite(accuracy)) return 'desconhecido';
  return accuracy <= MAX_ACCURACY_M ? 'bom' : 'fraco';
}

/** Reduz o percurso a no máximo `max` pontos, mantendo o primeiro e o último (para virar rota). */
export function decimate<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max || max < 2) return [...points];
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => points[Math.round(index * step)] as T);
}
