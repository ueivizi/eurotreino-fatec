/**
 * Rota desenhada no mapa: a pessoa toca os pontos do trajeto e o app mede a distância.
 *
 * É o caminho **sem GPS**, que foi a decisão do projeto: desenhar primeiro, satélite depois. Quem
 * corre sempre na mesma volta do quarteirão desenha uma vez e passa a registrar a distância certa,
 * sem dar ao app permissão de localização nem gastar bateria.
 *
 * A medida é a fórmula de haversine sobre a esfera média da Terra. Para trajeto urbano o erro
 * contra o elipsoide fica abaixo de 0,5% — menos do que a diferença entre o traço e a calçada.
 */

export type RoutePoint = {
  lat: number;
  lng: number;
};

/** Raio médio da Terra (IUGG), em metros. */
const EARTH_RADIUS_M = 6371008.8;

/** Teto do traçado: uma volta de quarteirão não precisa de mais, e o mapa não engasga. */
export const MAX_POINTS = 200;

/** Dois toques no mesmo lugar não viram dois pontos. */
const MIN_SEGMENT_M = 2;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(from: RoutePoint, to: RoutePoint): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function routeDistanceM(points: readonly RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1] as RoutePoint, points[i] as RoutePoint);
  }
  return Math.round(total);
}

/** Acrescenta um ponto, ignorando o toque repetido e respeitando o teto do traçado. */
export function addRoutePoint(points: readonly RoutePoint[], point: RoutePoint): RoutePoint[] {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return [...points];
  if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return [...points];
  if (points.length >= MAX_POINTS) return [...points];

  const last = points[points.length - 1];
  if (last && haversineMeters(last, point) < MIN_SEGMENT_M) return [...points];
  return [...points, point];
}

/** Fecha o circuito, para quem dá a volta e termina onde começou. */
export function closeRoute(points: readonly RoutePoint[]): RoutePoint[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 3 || haversineMeters(first, last) < MIN_SEGMENT_M) return [...points];
  return [...points, first];
}

type Position = [number, number];

/** GeoJSON no formato que o mapa entende: longitude antes da latitude. */
export function routeShape(points: readonly RoutePoint[]): {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: Record<string, never>; geometry: { type: 'LineString'; coordinates: Position[] } }[];
} {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: points.map((point): Position => [point.lng, point.lat]) },
      },
    ],
  };
}

export function pointsShape(points: readonly RoutePoint[]): {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: { first: boolean }; geometry: { type: 'Point'; coordinates: Position } }[];
} {
  return {
    type: 'FeatureCollection',
    features: points.map((point, index) => ({
      type: 'Feature' as const,
      properties: { first: index === 0 },
      geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] as Position },
    })),
  };
}

/** Caixa que contém o traçado, como o mapa pede: oeste, sul, leste, norte. */
export function routeBounds(points: readonly RoutePoint[]): [number, number, number, number] | null {
  if (points.length === 0) return null;
  const lngs = points.map((point) => point.lng);
  const lats = points.map((point) => point.lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

export type RouteProgress = {
  /** Distância da pessoa até o traçado. */
  offRouteM: number;
  /** Quanto do traçado já ficou para trás, medido ao longo dele. */
  doneM: number;
  remainingM: number;
};

/**
 * Onde a pessoa está em relação à rota a seguir: o ponto mais próximo do traçado diz quanto já foi
 * feito e quanto falta. Em volta fechada (fim no começo), o empate favorece o começo: quem acabou
 * de sair não aparece como quem está chegando.
 */
export function routeProgress(position: RoutePoint, route: readonly RoutePoint[]): RouteProgress | null {
  if (route.length < 2) return null;
  // Plano local em metros (equiretangular): para distâncias de rua, o erro é desprezível.
  const k = Math.cos(toRadians(position.lat));
  const toXY = (point: RoutePoint): [number, number] => [
    toRadians(point.lng - position.lng) * EARTH_RADIUS_M * k,
    toRadians(point.lat - position.lat) * EARTH_RADIUS_M,
  ];

  let walked = 0;
  let best: { off: number; done: number } | null = null;
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1] as RoutePoint;
    const b = route[i] as RoutePoint;
    const [ax, ay] = toXY(a);
    const [bx, by] = toXY(b);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq));
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    const segment = haversineMeters(a, b);
    // Meio metro de folga: num empate, fica o trecho que vem antes.
    if (!best || off < best.off - 0.5) best = { off, done: walked + t * segment };
    walked += segment;
  }
  if (!best) return null;
  const doneM = Math.round(best.done);
  return { offRouteM: Math.round(best.off), doneM, remainingM: Math.max(0, Math.round(walked) - doneM) };
}

/**
 * Reduz um traçado longo (vindo do GPS ou do roteador) ao teto de pontos guardados, tirando primeiro
 * os pontos que menos mudam o desenho (Douglas-Peucker com tolerância crescente).
 */
export function simplifyRoute(points: readonly RoutePoint[], maxPoints = MAX_POINTS): RoutePoint[] {
  if (points.length <= maxPoints || maxPoints < 2) return [...points];
  let tolerance = 2;
  let result = [...points];
  while (result.length > maxPoints && tolerance < 5000) {
    result = douglasPeucker(points, tolerance);
    tolerance *= 1.6;
  }
  return result.length > maxPoints ? [points[0] as RoutePoint, points[points.length - 1] as RoutePoint] : result;
}

function douglasPeucker(points: readonly RoutePoint[], toleranceM: number): RoutePoint[] {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let farthest = -1;
    let max = 0;
    for (let i = first + 1; i < last; i += 1) {
      const progress = routeProgress(points[i] as RoutePoint, [points[first] as RoutePoint, points[last] as RoutePoint]);
      const distance = progress?.offRouteM ?? 0;
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

/** Zona de privacidade: quanto do começo e do fim sai de uma rota compartilhada. */
export const PRIVACY_TRIM_M = 300;

/**
 * Corta o começo e o fim do traçado (onde costuma ficar a casa de quem compartilha), cortando no
 * meio do trecho quando preciso. Rota curta demais para perder 2 × o corte perde só um terço de
 * cada lado, para ainda sobrar caminho.
 */
export function trimEnds(points: readonly RoutePoint[], meters = PRIVACY_TRIM_M): RoutePoint[] {
  if (points.length < 2) return [...points];
  const total = routeDistanceM(points);
  const cut = Math.min(meters, total / 3);
  if (cut <= 0) return [...points];
  const head = cutFromStart(points, cut);
  return cutFromStart([...head].reverse(), cut).reverse();
}

function cutFromStart(points: readonly RoutePoint[], meters: number): RoutePoint[] {
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as RoutePoint;
    const b = points[i] as RoutePoint;
    const leg = haversineMeters(a, b);
    if (walked + leg >= meters) {
      const t = leg === 0 ? 0 : (meters - walked) / leg;
      const start = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
      return [start, ...points.slice(i)];
    }
    walked += leg;
  }
  return [points[points.length - 1] as RoutePoint];
}
