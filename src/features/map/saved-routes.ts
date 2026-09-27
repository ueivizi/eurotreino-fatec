import { deviceStorage } from '@/lib/device-storage';

import { MAX_POINTS, routeDistanceM, type RoutePoint } from './route';

/**
 * Rotas desenhadas ficam só no aparelho, como o trajeto do GPX: o servidor nunca recebe o traçado.
 * O armazenamento é o seguro do celular (em pedaços), então o total é pequeno de propósito.
 */
const STORAGE_KEY = 'eurotreino.rotas';
export const MAX_ROUTES = 10;
export const ROUTE_NAME_MAX = 40;

export type SavedRoute = {
  id: string;
  name: string;
  points: RoutePoint[];
  distanceM: number;
  savedAt: string;
};

/** Cinco casas decimais são ~1 m: basta para o traçado e cabe no armazenamento seguro. */
function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

function isPoint(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

export function normalizeRouteName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, ROUTE_NAME_MAX);
}

/**
 * Lê o que está guardado sem confiar no formato: qualquer item fora do esperado é descartado, e a
 * distância é recalculada dos pontos em vez de lida.
 */
export function parseSavedRoutes(raw: string | null): SavedRoute[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const routes: SavedRoute[] = [];
  for (const item of data.slice(0, MAX_ROUTES)) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, name, points, savedAt } = item as Record<string, unknown>;
    if (typeof id !== 'string' || id.length === 0 || id.length > 64) continue;
    if (typeof name !== 'string' || typeof savedAt !== 'string' || Number.isNaN(Date.parse(savedAt))) continue;
    if (!Array.isArray(points) || points.length < 2 || points.length > MAX_POINTS + 1 || !points.every(isPoint)) continue;
    const route = points.map(([lng, lat]) => ({ lat, lng }));
    const cleanName = normalizeRouteName(name);
    if (!cleanName) continue;
    routes.push({ id, name: cleanName, points: route, distanceM: routeDistanceM(route), savedAt });
  }
  return routes;
}

export function serializeRoutes(routes: readonly SavedRoute[]): string {
  return JSON.stringify(
    routes.slice(0, MAX_ROUTES).map((route) => ({
      id: route.id,
      name: route.name,
      savedAt: route.savedAt,
      points: route.points.map((point) => [round(point.lng), round(point.lat)]),
    })),
  );
}

/** A mais recente primeiro; salvar com o mesmo id substitui, e passar do teto descarta a mais antiga. */
export function withRoute(routes: readonly SavedRoute[], route: SavedRoute): SavedRoute[] {
  return [route, ...routes.filter((item) => item.id !== route.id)].slice(0, MAX_ROUTES);
}

export async function loadRoutes(): Promise<SavedRoute[]> {
  return parseSavedRoutes(await deviceStorage.getItem(STORAGE_KEY));
}

export async function storeRoutes(routes: readonly SavedRoute[]): Promise<void> {
  await deviceStorage.setItem(STORAGE_KEY, serializeRoutes(routes));
}
