import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { isRow } from '@/lib/parse';
import { ApiError, RPC_MESSAGES, toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import { MAX_POINTS, simplifyRoute, type RoutePoint } from './route';

/**
 * Roteador (OpenRouteService, pela Edge Function "rotas"). Só as coordenadas saem do aparelho, e
 * vão primeiro ao nosso servidor, que guarda a chave e repassa sem conta nem IP de quem pediu.
 */
export type RoutingModality = 'pe' | 'bike';

export type RoutedPath = {
  points: RoutePoint[];
  distanceM: number;
  ascentM: number;
  descentM: number;
  /** Parte em ciclovia e parte longe dos carros, de 0 a 100. */
  cyclewayPct: number;
  calmPct: number;
};

export const ROUTING_CREDIT = '© openrouteservice by HeiGIT · OpenStreetMap';
/** O roteador aceita até 25 paradas por rota. */
export const MAX_WAYPOINTS = 25;
export const ROUTING_MODALITIES = [
  { id: 'pe', label: 'A pé' },
  { id: 'bike', label: 'Bike' },
] as const satisfies readonly { id: RoutingModality; label: string }[];

export const ROUTING_PRIVACY =
  'Para traçar pelas ruas, os pontos vão ao OpenRouteService (HeiGIT) pelo nosso servidor, sem a sua conta. Nada fica guardado lá nem aqui.';

/** "5,2 km · subida de 41 m · 57% em ciclovia" (só o que tiver). */
export function describeRoutedPath(path: RoutedPath, formatDistance: (meters: number) => string): string {
  return [
    formatDistance(path.distanceM),
    path.ascentM >= 5 ? `subida de ${path.ascentM} m` : null,
    path.cyclewayPct >= 5 ? `${path.cyclewayPct}% em ciclovia` : path.calmPct >= 20 ? `${path.calmPct}% longe dos carros` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
export const LOOP_DISTANCES = [3_000, 5_000, 10_000, 20_000] as const;

function toPosition(point: RoutePoint): [number, number] {
  return [Math.round(point.lng * 1e5) / 1e5, Math.round(point.lat * 1e5) / 1e5];
}

function finite(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

/** Resposta da função, conferida item a item: fora do formato vira falha, nunca dado. */
export function parseRoutedPaths(body: unknown): RoutedPath[] | null {
  if (!isRow(body) || !Array.isArray(body.rotas) || body.rotas.length === 0 || body.rotas.length > 3) return null;
  const paths: RoutedPath[] = [];
  for (const item of body.rotas) {
    if (!isRow(item) || !Array.isArray(item.pontos) || item.pontos.length < 2 || item.pontos.length > 1000) return null;
    const points: RoutePoint[] = [];
    for (const pair of item.pontos) {
      if (!Array.isArray(pair) || pair.length !== 2) return null;
      const [lng, lat] = pair as unknown[];
      if (typeof lng !== 'number' || typeof lat !== 'number' || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
      points.push({ lat, lng });
    }
    const distanceM = finite(item.distanciaM, 500_000);
    const ascentM = finite(item.subidaM, 20_000);
    const descentM = finite(item.descidaM, 20_000);
    const cyclewayPct = finite(item.cicloviaPct, 100);
    const calmPct = finite(item.calmaPct, 100);
    if (distanceM === null || ascentM === null || descentM === null || cyclewayPct === null || calmPct === null) return null;
    // O aparelho guarda até MAX_POINTS por rota: o desenho já chega no tamanho de guardar.
    paths.push({ points: simplifyRoute(points, MAX_POINTS), distanceM, ascentM, descentM, cyclewayPct, calmPct });
  }
  return paths;
}

const KNOWN_FAILURES: Record<string, string> = {
  rate_limited: 'rate_limited',
  no_route: 'no_route',
  unavailable: 'routing_unavailable',
  not_authenticated: 'not_authenticated',
};

async function failureFrom(error: unknown): Promise<ApiError> {
  if (error instanceof FunctionsHttpError) {
    let body: unknown = null;
    try {
      body = await (error.context as Response).json();
    } catch {
      body = null;
    }
    const code = isRow(body) && typeof body.error === 'string' ? KNOWN_FAILURES[body.error] : undefined;
    return code ? toApiError({ message: code }) : unexpectedResponse();
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return new ApiError(RPC_MESSAGES.network, null, true);
  }
  return unexpectedResponse();
}

async function callRouter(body: Record<string, unknown>): Promise<RoutedPath[]> {
  const { data, error } = await getSupabase().functions.invoke('rotas', { method: 'POST', body });
  if (error) throw await failureFrom(error);
  const paths = parseRoutedPaths(data);
  if (!paths) throw unexpectedResponse();
  return paths;
}

/** Rota que segue ruas e ciclovias passando pelos pontos tocados, na ordem. */
export async function routeThrough(modality: RoutingModality, waypoints: readonly RoutePoint[]): Promise<RoutedPath> {
  const [path] = await callRouter({ tipo: 'rota', modalidade: modality, pontos: waypoints.map(toPosition) });
  if (!path) throw unexpectedResponse();
  return path;
}

/** Três voltas que começam e terminam no ponto dado; `variation` muda as opções a cada pedido. */
export async function generateLoops(
  modality: RoutingModality,
  start: RoutePoint,
  distanceM: number,
  variation: number,
): Promise<RoutedPath[]> {
  return callRouter({ tipo: 'volta', modalidade: modality, inicio: toPosition(start), distanciaM: Math.round(distanceM), variacao: variation % 1000 });
}
