import type { ThemeName } from '@/theme/tokens';

import { haversineMeters, type RoutePoint } from './route';

/**
 * Lugares perto de quem treina, tirados do próprio mapa base (camada `poi` do OpenMapTiles, dados do
 * OpenStreetMap). Não há busca em servidor: o app lê o que já está desenhado na tela.
 */
export type PlaceKind = 'cafe' | 'bicicletaria' | 'agua' | 'banheiro' | 'farmacia' | 'shopping';

type PlaceDef = { id: PlaceKind; label: string; singular: string; subclasses: readonly string[] };

export const PLACE_KINDS: readonly PlaceDef[] = [
  { id: 'cafe', label: 'Cafés', singular: 'Café', subclasses: ['cafe'] },
  { id: 'bicicletaria', label: 'Bicicletarias', singular: 'Bicicletaria', subclasses: ['bicycle', 'bicycle_repair_station'] },
  { id: 'agua', label: 'Água', singular: 'Bebedouro', subclasses: ['drinking_water'] },
  { id: 'banheiro', label: 'Banheiros', singular: 'Banheiro', subclasses: ['toilets'] },
  { id: 'farmacia', label: 'Farmácias', singular: 'Farmácia', subclasses: ['pharmacy', 'chemist'] },
  { id: 'shopping', label: 'Shoppings', singular: 'Shopping', subclasses: ['mall', 'department_store'] },
];

export const PLACE_COLORS: Record<ThemeName, Record<PlaceKind, string>> = {
  onix: { cafe: '#D9A066', bicicletaria: '#5FD08A', agua: '#4FB3E0', banheiro: '#B9A8E0', farmacia: '#E07A7A', shopping: '#E6C878' },
  marmore: { cafe: '#8C5A2B', bicicletaria: '#1E8A4C', agua: '#1B6FA8', banheiro: '#6A4FA8', farmacia: '#B03A3A', shopping: '#8A6A24' },
};

const KIND_BY_SUBCLASS = new Map(PLACE_KINDS.flatMap((kind) => kind.subclasses.map((subclass) => [subclass, kind.id] as const)));

export function placeKindOf(subclass: unknown): PlaceKind | null {
  return typeof subclass === 'string' ? (KIND_BY_SUBCLASS.get(subclass) ?? null) : null;
}

export function placeLabel(kind: PlaceKind): string {
  return PLACE_KINDS.find((item) => item.id === kind)?.singular ?? '';
}

/** Filtro do mapa: só as subclasses das categorias ligadas. */
export function placeSubclasses(kinds: readonly PlaceKind[]): string[] {
  return PLACE_KINDS.filter((kind) => kinds.includes(kind.id)).flatMap((kind) => [...kind.subclasses]);
}

export type NearbyPlace = {
  key: string;
  name: string;
  kind: PlaceKind;
  point: RoutePoint;
  distanceM: number;
};

/** Um lugar sem nome no mapa ainda serve (um bebedouro), então ele ganha o nome da categoria. */
function nameOf(properties: Record<string, unknown>, kind: PlaceKind): string {
  const raw = properties['name:pt'] ?? properties.name;
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  return name || placeLabel(kind);
}

/**
 * Transforma o que o mapa devolveu em lista: valida cada item (dado de fora), junta os repetidos (o
 * mesmo lugar aparece em mais de um ladrilho) e ordena pela distância de quem pergunta.
 */
export function nearbyPlaces(features: readonly unknown[], from: RoutePoint, limit = 20): NearbyPlace[] {
  const seen = new Set<string>();
  const places: NearbyPlace[] = [];
  for (const feature of features) {
    if (typeof feature !== 'object' || feature === null) continue;
    const { properties, geometry } = feature as { properties?: unknown; geometry?: unknown };
    if (typeof properties !== 'object' || properties === null) continue;
    if (typeof geometry !== 'object' || geometry === null) continue;
    const { type, coordinates } = geometry as { type?: unknown; coordinates?: unknown };
    if (type !== 'Point' || !Array.isArray(coordinates) || coordinates.length < 2) continue;
    const [lng, lat] = coordinates as unknown[];
    if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;

    const props = properties as Record<string, unknown>;
    const kind = placeKindOf(props.subclass);
    if (!kind) continue;
    const name = nameOf(props, kind);
    // ~20 m de grade: o mesmo lugar repetido na borda de dois ladrilhos vira um só.
    const key = `${kind}|${name}|${Math.round(lat * 5000)}|${Math.round(lng * 5000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const point = { lat, lng };
    places.push({ key, name, kind, point, distanceM: Math.round(haversineMeters(from, point)) });
  }
  return places.sort((a, b) => a.distanceM - b.distanceM || a.name.localeCompare(b.name, 'pt-BR')).slice(0, limit);
}
