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
