import { workoutTypeFromGpx } from './activity-map';

/**
 * Leitor de GPX exportado por Garmin Connect, Zepp, Strava e afins: trajeto com horário e, quando há,
 * frequência cardíaca (extensão TrackPointExtension). O arquivo vem de fora, então o leitor tem limites
 * de tamanho e de pontos e percorre o texto uma vez só: nada de expressão que volte atrás no texto.
 */

export const GPX_MAX_BYTES = 5 * 1024 * 1024;
const MAX_POINTS = 100_000;
/** Salto maior que isso entre dois pontos seguidos é falha de GPS, não deslocamento. */
const MAX_SEGMENT_M = 5_000;

export type GpxPoint = { lat: number; lon: number; time: Date | null; hr: number | null };

export type GpxSummary = {
  name: string | null;
  type: string | null;
  startedAt: Date;
  endedAt: Date;
  distanceM: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  pointCount: number;
  /** Impressão digital estável do arquivo, para reimportar sem duplicar. */
  fingerprint: string;
  suggestedTypeFromFile: ReturnType<typeof workoutTypeFromGpx>;
};

export type GpxError = 'too_large' | 'not_gpx' | 'no_track' | 'no_time';

export const GPX_ERROR_MESSAGES: Record<GpxError, string> = {
  too_large: 'O arquivo passa de 5 MB. Exporte só o treino, não o histórico inteiro.',
  not_gpx: 'Não parece um arquivo GPX. Exporte o treino em GPX no app do relógio.',
  no_track: 'O arquivo não tem trajeto com pontos suficientes.',
  no_time: 'O trajeto não tem horário, e sem horário não dá para saber quando o treino aconteceu.',
};

function textOf(chunk: string, tag: string): string | null {
  // Aceita prefixo de namespace (<gpxtpx:hr>) sem regex com repetição aninhada.
  const open = new RegExp(`<(?:[A-Za-z0-9_]{1,20}:)?${tag}>`);
  const match = open.exec(chunk);
  if (!match) return null;
  const start = match.index + match[0].length;
  const end = chunk.indexOf('</', start);
  if (end < 0 || end - start > 200) return null;
  return decodeXmlText(chunk.slice(start, end).trim());
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function attribute(tagText: string, name: string): number | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*["'](-?\\d{1,3}(?:\\.\\d{1,12})?)["']`).exec(tagText);
  return match ? Number(match[1]) : null;
}

export function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const radius = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function parseGpx(text: string): { ok: true; summary: GpxSummary } | { ok: false; error: GpxError } {
  if (text.length > GPX_MAX_BYTES) return { ok: false, error: 'too_large' };
  const head = text.slice(0, 2000);
  if (!/<gpx[\s>]/i.test(head)) return { ok: false, error: 'not_gpx' };

  // Nome e tipo ficam no começo da trilha, antes do primeiro segmento.
  const trackStart = text.search(/<trk[\s>]/);
  let trackHead = '';
  if (trackStart >= 0) {
    const segment = text.indexOf('<trkseg', trackStart);
    const limit = trackStart + 2000;
    trackHead = text.slice(trackStart, segment >= 0 ? Math.min(segment, limit) : limit);
  }
  const name = trackHead ? textOf(trackHead, 'name') : null;
  const type = trackHead ? textOf(trackHead, 'type') : null;

  const points: GpxPoint[] = [];
  const chunks = text.split('<trkpt');
  for (let i = 1; i < chunks.length && points.length < MAX_POINTS; i += 1) {
    const chunk = chunks[i];
    const tagEnd = chunk.indexOf('>');
    if (tagEnd < 0) continue;
    const lat = attribute(chunk.slice(0, tagEnd), 'lat');
    const lon = attribute(chunk.slice(0, tagEnd), 'lon');
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const closing = chunk.indexOf('</trkpt>');
    const body = closing >= 0 ? chunk.slice(tagEnd + 1, closing) : '';
    const timeText = textOf(body, 'time');
    const time = timeText !== null && !Number.isNaN(Date.parse(timeText)) ? new Date(timeText) : null;
    const hrText = textOf(body, 'hr');
    const hr = hrText !== null && /^\d{2,3}$/.test(hrText) ? Number(hrText) : null;
    points.push({ lat, lon, time, hr });
  }

  if (points.length < 2) return { ok: false, error: 'no_track' };
  const timed = points.filter((point) => point.time !== null) as (GpxPoint & { time: Date })[];
  if (timed.length < 2) return { ok: false, error: 'no_time' };

  // Um ponto isolado longe do trajeto é falha de GPS: a distância segue do último ponto bom. Dois pontos
  // seguidos longe, e perto um do outro, são uma posição nova de verdade (ex.: GPS religado depois).
  let distanceM = 0;
  let anchor: GpxPoint = points[0];
  let pending: GpxPoint | null = null;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    const fromAnchor = haversineMeters(anchor, point);
    if (fromAnchor <= MAX_SEGMENT_M) {
      distanceM += fromAnchor;
      anchor = point;
      pending = null;
    } else if (pending !== null && haversineMeters(pending, point) <= MAX_SEGMENT_M) {
      distanceM += haversineMeters(pending, point);
      anchor = point;
      pending = null;
    } else {
      pending = point;
    }
  }

  // Laços em vez de Math.min(...lista): com 100 mil pontos o espalhamento estoura a pilha.
  let first = Infinity;
  let last = -Infinity;
  for (const point of timed) {
    const at = point.time.getTime();
    if (at < first) first = at;
    if (at > last) last = at;
  }
  const startedAt = new Date(first);
  const endedAt = new Date(last);

  let rateSum = 0;
  let rateCount = 0;
  let rateMax: number | null = null;
  for (const point of points) {
    if (point.hr === null || point.hr < 30 || point.hr > 240) continue;
    rateSum += point.hr;
    rateCount += 1;
    rateMax = rateMax === null ? point.hr : Math.max(rateMax, point.hr);
  }

  return {
    ok: true,
    summary: {
      name,
      type,
      startedAt,
      endedAt,
      distanceM: Math.round(distanceM),
      avgHeartRate: rateCount > 0 ? Math.round(rateSum / rateCount) : null,
      maxHeartRate: rateMax,
      pointCount: points.length,
      fingerprint: `${startedAt.toISOString()}|${endedAt.toISOString()}|${points.length}`,
      suggestedTypeFromFile: workoutTypeFromGpx(type),
    },
  };
}
