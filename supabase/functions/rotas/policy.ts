// Regras da função "rotas", sem dependências: rodam no Deno (Edge Function) e nos testes do Node.
//
// A função é a ponte entre o app e o OpenRouteService (HeiGIT): a chave fica só aqui, e o
// OpenRouteService recebe apenas coordenadas, sem conta, nome ou IP de quem pediu (os termos dele
// proíbem enviar dados pessoais). Tudo que entra e tudo que volta é conferido por lista fechada.

export const ORS_URL = 'https://api.openrouteservice.org/v2/directions';
export const ORS_CREDIT = '© openrouteservice by HeiGIT | Data from OpenStreetMap';

/** Tamanho máximo do corpo do pedido, em bytes: 25 pontos cabem com folga. */
export const MAX_BODY_BYTES = 4096;
export const MAX_WAYPOINTS = 25;
/** Nenhum trecho entre dois pontos tocados passa disto: rota de treino, não de viagem. */
export const MAX_LEG_M = 30_000;
export const LOOP_LENGTH = { min: 1_000, max: 60_000 } as const;
/** Voltas geradas por pedido: três opções para escolher. */
export const LOOP_OPTIONS = 3;
/** Teto de pontos devolvidos por rota: o desenho continua fiel e a resposta, pequena. */
export const MAX_RETURNED_POINTS = 400;

const PROFILES = { pe: 'foot-walking', bike: 'cycling-regular' } as const;
export type Modality = keyof typeof PROFILES;
export type Position = [number, number];

export type RouteRequest =
  | { kind: 'rota'; modality: Modality; points: Position[] }
  | { kind: 'volta'; modality: Modality; start: Position; lengthM: number; variation: number };

const EARTH_RADIUS_M = 6371008.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineM([lng1, lat1]: Position, [lng2, lat2]: Position): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function position(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lng, lat] = value;
  if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  return [lng, lat];
}

function isModality(value: unknown): value is Modality {
  return value === 'pe' || value === 'bike';
}

/** Pedido do app: `{ tipo: 'rota', modalidade, pontos }` ou `{ tipo: 'volta', modalidade, inicio, distanciaM, variacao }`. */
export function parseRouteRequest(body: unknown): RouteRequest | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const allowed = record.tipo === 'rota' ? ['tipo', 'modalidade', 'pontos'] : ['tipo', 'modalidade', 'inicio', 'distanciaM', 'variacao'];
  if (Object.keys(record).some((key) => !allowed.includes(key))) return null;
  if (!isModality(record.modalidade)) return null;

  if (record.tipo === 'rota') {
    if (!Array.isArray(record.pontos) || record.pontos.length < 2 || record.pontos.length > MAX_WAYPOINTS) return null;
    const points: Position[] = [];
    for (const item of record.pontos) {
      const point = position(item);
      if (!point) return null;
      const previous = points[points.length - 1];
      if (previous && haversineM(previous, point) > MAX_LEG_M) return null;
      points.push(point);
    }
    return { kind: 'rota', modality: record.modalidade, points };
  }

  if (record.tipo === 'volta') {
    const start = position(record.inicio);
    const lengthM = record.distanciaM;
    const variation = record.variacao ?? 0;
    if (!start) return null;
    if (typeof lengthM !== 'number' || !Number.isInteger(lengthM) || lengthM < LOOP_LENGTH.min || lengthM > LOOP_LENGTH.max) return null;
    if (typeof variation !== 'number' || !Number.isInteger(variation) || variation < 0 || variation > 999) return null;
    return { kind: 'volta', modality: record.modalidade, start, lengthM, variation };
  }
  return null;
}

export type OrsCall = { profile: string; body: Record<string, unknown> };

/** Pedidos ao OpenRouteService: um para a rota; três sementes diferentes para as voltas. */
export function orsCalls(request: RouteRequest): OrsCall[] {
  const profile = PROFILES[request.modality];
  const common = { elevation: true, instructions: false, extra_info: ['waytype'], units: 'm' };
  if (request.kind === 'rota') {
    return [{ profile, body: { ...common, coordinates: request.points, preference: 'recommended' } }];
  }
  return Array.from({ length: LOOP_OPTIONS }, (_, index) => ({
    profile,
    body: {
      ...common,
      coordinates: [request.start],
      options: { round_trip: { length: request.lengthM, points: 5, seed: request.variation * LOOP_OPTIONS + index } },
    },
  }));
}

export type RouteResult = {
  pontos: Position[];
  distanciaM: number;
  subidaM: number;
  descidaM: number;
  /** Parte da rota em ciclovia, de 0 a 100. */
  cicloviaPct: number;
  /** Parte longe dos carros (ciclovia, caminho, trilha, calçada), de 0 a 100. */
  calmaPct: number;
};

// Tipos de via do OpenRouteService: 4 caminho, 5 trilha, 6 ciclovia, 7 calçada ou passeio.
const CYCLEWAY = 6;
const CALM = new Set([4, 5, 6, 7]);

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Distância de um ponto ao segmento, em metros, num plano local (basta para simplificar). */
function segmentDistanceM(p: Position, a: Position, b: Position): number {
  const k = Math.cos(toRadians(p[1]));
  const toXY = ([lng, lat]: Position): [number, number] => [toRadians(lng) * EARTH_RADIUS_M * k, toRadians(lat) * EARTH_RADIUS_M];
  const [px, py] = toXY(p);
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function douglasPeucker(points: Position[], toleranceM: number): Position[] {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let farthest = -1;
    let max = 0;
    for (let i = first + 1; i < last; i += 1) {
      const distance = segmentDistanceM(points[i] as Position, points[first] as Position, points[last] as Position);
      if (distance > max) {
        max = distance;
        farthest = i;
      }
    }
    if (farthest !== -1 && max > toleranceM) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

export function simplify(points: Position[], maxPoints = MAX_RETURNED_POINTS): Position[] {
  if (points.length <= maxPoints) return points;
  let tolerance = 1;
  let result = points;
  while (result.length > maxPoints && tolerance < 5_000) {
    result = douglasPeucker(points, tolerance);
    tolerance *= 1.6;
  }
  return result;
}

const round5 = (value: number) => Math.round(value * 1e5) / 1e5;

/** Lê a resposta do OpenRouteService sem confiar no formato; `null` se algo não bater. */
export function parseOrsRoute(payload: unknown): RouteResult | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const feature = features[0] as { geometry?: unknown; properties?: unknown };
  if (typeof feature !== 'object' || feature === null) return null;

  const geometry = feature.geometry as { type?: unknown; coordinates?: unknown } | null;
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
  const coordinates = geometry.coordinates as unknown[];
  if (coordinates.length < 2 || coordinates.length > 50_000) return null;
  const points: Position[] = [];
  for (const item of coordinates) {
    // Com elevação, cada ponto vem como [lng, lat, altitude]; a altitude fica de fora.
    if (!Array.isArray(item) || item.length < 2) return null;
    const point = position([item[0], item[1]]);
    if (!point) return null;
    points.push(point);
  }

  const properties = (feature.properties ?? {}) as Record<string, unknown>;
  const summary = (properties.summary ?? {}) as Record<string, unknown>;
  const distance = finiteNonNegative(summary.distance);
  if (distance === null || distance > 500_000) return null;
  const ascent = finiteNonNegative(properties.ascent) ?? 0;
  const descent = finiteNonNegative(properties.descent) ?? 0;

  let cycleway = 0;
  let calm = 0;
  const extras = properties.extras as { waytypes?: { summary?: unknown } } | undefined;
  const waytypes = extras?.waytypes?.summary;
  if (Array.isArray(waytypes)) {
    for (const entry of waytypes) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { value, amount } = entry as Record<string, unknown>;
      const share = finiteNonNegative(amount);
      if (typeof value !== 'number' || share === null) continue;
      if (value === CYCLEWAY) cycleway += share;
      if (CALM.has(value)) calm += share;
    }
  }

  return {
    pontos: simplify(points).map(([lng, lat]): Position => [round5(lng), round5(lat)]),
    distanciaM: Math.round(distance),
    subidaM: Math.round(ascent),
    descidaM: Math.round(descent),
    cicloviaPct: Math.min(100, Math.round(cycleway)),
    calmaPct: Math.min(100, Math.round(calm)),
  };
}

export type OrsFailure = 'no_route' | 'unavailable';

/**
 * Falha do OpenRouteService em código estável: ponto sem via por perto ou rota impossível viram
 * `no_route`; cota, chave ou servidor fora viram `unavailable`.
 */
export function orsFailure(status: number): OrsFailure {
  return status === 400 || status === 404 ? 'no_route' : 'unavailable';
}

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/** Token do cabeçalho Authorization, só se tiver o formato de um JWT. */
export function bearerToken(header: string | null): string | null {
  if (header === null || header.length > 4096) return null;
  return BEARER.exec(header)?.[1] ?? null;
}

/** Chave publicável do projeto: a nova (SUPABASE_PUBLISHABLE_KEYS, JSON) ou a antiga (anon). */
export function projectPublishableKey(keysJson: string | undefined, legacyAnonKey: string | undefined): string | null {
  if (keysJson) {
    try {
      const parsed: unknown = JSON.parse(keysJson);
      if (typeof parsed === 'object' && parsed !== null) {
        const key = (parsed as Record<string, unknown>).default;
        if (typeof key === 'string' && key.length > 0) return key;
      }
    } catch {
      // Valor malformado: tenta a chave antiga abaixo e, sem ela, a função recusa o pedido.
    }
  }
  return legacyAnonKey && legacyAnonKey.length > 0 ? legacyAnonKey : null;
}

/** Origens da versão Web que podem chamar a função pelo navegador (os apps nativos não usam CORS). */
export function corsHeadersFor(origin: string | null, allowedOrigins: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const allowed = (allowedOrigins ?? 'http://localhost:8081')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== '*');
  if (origin !== null && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
