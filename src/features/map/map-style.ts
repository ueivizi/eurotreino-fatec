import type { ThemeName } from '@/theme/tokens';

/**
 * Estilos do OpenFreeMap: dados do OpenStreetMap, sem chave de API. O servidor de mapa recebe só o
 * endereço IP e a área que está na tela, como qualquer mapa.
 */
export const MAP_STYLES: Record<ThemeName, string> = {
  onix: 'https://tiles.openfreemap.org/styles/dark',
  marmore: 'https://tiles.openfreemap.org/styles/positron',
};

/** Fonte vetorial que os dois estilos declaram: ruas, lugares e ciclovias vêm dela. */
export const BASE_SOURCE = 'openmaptiles';

/** Sem posição, o mapa abre no centro de São Paulo (fuso e público do app). */
export const DEFAULT_CENTER: [number, number] = [-46.6333, -23.5505];

/** Crédito à vista, como pede a licença do OpenStreetMap: o estilo não traz o texto embutido. */
export const MAP_CREDIT = '© OpenStreetMap · OpenMapTiles · OpenFreeMap';

export const EMPTY_SHAPE = { type: 'FeatureCollection' as const, features: [] };
