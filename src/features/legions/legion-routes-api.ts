import { isIsoDate, isNonEmptyText, isRow, isUuid, parseList } from '@/lib/parse';
import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import { MAX_POINTS, type RoutePoint } from '@/features/map/route';
import type { RoutingModality } from '@/features/map/routing-api';

/**
 * Rotas da Legião: compartilhadas por um membro, vistas só pelos membros. O app corta começo e
 * fim antes de enviar (zona de privacidade); o banco confere o traçado e mede a distância.
 */
export type LegionRoute = {
  id: string;
  name: string;
  modality: RoutingModality;
  points: RoutePoint[];
  distanceM: number;
  createdAt: string;
  authorName: string;
  isMine: boolean;
  canDelete: boolean;
};

function parsePoints(value: unknown): RoutePoint[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_POINTS) return null;
  const points: RoutePoint[] = [];
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [lng, lat] = pair as unknown[];
    if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
    points.push({ lat, lng });
  }
  return points;
}

export function parseLegionRoute(row: unknown): LegionRoute | null {
  if (!isRow(row) || !isUuid(row.id) || !isNonEmptyText(row.name, 40) || !isNonEmptyText(row.author_name, 32)) return null;
  if (row.modality !== 'pe' && row.modality !== 'bike') return null;
  if (typeof row.distance_m !== 'number' || !Number.isInteger(row.distance_m) || row.distance_m < 100 || row.distance_m > 200_000) return null;
  if (!isIsoDate(row.created_at) || typeof row.is_mine !== 'boolean' || typeof row.can_delete !== 'boolean') return null;
  const points = parsePoints(row.points);
  if (!points) return null;
  return {
    id: row.id,
    name: row.name,
    modality: row.modality,
    points,
    distanceM: row.distance_m,
    createdAt: row.created_at,
    authorName: row.author_name,
    isMine: row.is_mine,
    canDelete: row.can_delete,
  };
}

export async function fetchLegionRoutes(legionId: string): Promise<LegionRoute[]> {
  if (!isUuid(legionId)) throw unexpectedResponse();
  const { data, error } = await getSupabase().rpc('legion_routes', { p_group_id: legionId });
  if (error) throw toApiError(error);
  const routes = parseList(data, parseLegionRoute);
  if (!routes) throw unexpectedResponse();
  return routes;
}

export async function shareRoute(input: { legionId: string; name: string; modality: RoutingModality; points: readonly RoutePoint[] }): Promise<string> {
  if (!isUuid(input.legionId)) throw unexpectedResponse();
  const { data, error } = await getSupabase().rpc('share_route', {
    p_group_id: input.legionId,
    p_name: input.name,
    p_modality: input.modality,
    // Cinco casas (~1 m) bastam para o traçado e deixam o pedido pequeno.
    p_points: input.points.map((point) => [Math.round(point.lng * 1e5) / 1e5, Math.round(point.lat * 1e5) / 1e5]),
  });
  if (error) throw toApiError(error);
  if (!isUuid(data)) throw unexpectedResponse();
  return data;
}

export async function deleteSharedRoute(routeId: string): Promise<void> {
  if (!isUuid(routeId)) throw unexpectedResponse();
  const { error } = await getSupabase().rpc('delete_shared_route', { p_route_id: routeId });
  if (error) throw toApiError(error);
}
