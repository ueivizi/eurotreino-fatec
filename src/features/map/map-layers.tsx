import { GeoJSONSource, Layer, type FilterSpecification } from '@maplibre/maplibre-react-native';

import { useTheme } from '@/theme/theme';

import { CYCLE_COLORS, saoPauloCycleways } from './cycleways';
import { BASE_SOURCE, EMPTY_SHAPE } from './map-style';
import { PLACE_COLORS, PLACE_KINDS, placeSubclasses, type PlaceKind } from './places';
import { routeShape, type RoutePoint } from './route';

/** Camadas que o toque no mapa consulta para dizer o que é. */
export const TAPPABLE_LAYERS = ['lugares-ponto', 'cet-vagas', 'cet-vias', 'osm-ciclovias'];
export const PLACE_LAYER = 'lugares-ponto';

/**
 * Ciclovias: as do OpenStreetMap (mundo todo, do mapa base) e a rede da CET em São Paulo, com
 * ciclofaixa, ciclorrota e bicicletário. Escondidas, continuam carregadas: ligar de novo é imediato.
 */
export function CyclewayLayers({ visible }: { visible: boolean }) {
  const { name } = useTheme();
  const colors = CYCLE_COLORS[name];
  const visibility = visible ? 'visible' : 'none';

  return (
    <>
      <Layer
        id="osm-ciclovias"
        type="line"
        source={BASE_SOURCE}
        source-layer="transportation"
        minzoom={12}
        filter={['any', ['==', ['get', 'subclass'], 'cycleway'], ['==', ['get', 'bicycle'], 'designated']]}
        layout={{ visibility, 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': colors.ciclovia, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.5, 17, 4], 'line-opacity': 0.9 }}
      />
      <GeoJSONSource id="cet" data={visible ? saoPauloCycleways() : EMPTY_SHAPE}>
        <Layer
          id="cet-vias"
          type="line"
          filter={['!=', ['geometry-type'], 'Point']}
          layout={{ visibility, 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': ['match', ['get', 'tipo'], 'ciclofaixa', colors.ciclofaixa, 'ciclorrota', colors.ciclorrota, colors.ciclovia],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 17, 5],
            'line-dasharray': ['match', ['get', 'tipo'], 'ciclorrota', ['literal', [1.5, 1.5]], ['literal', [1, 0]]],
          }}
        />
        <Layer
          id="cet-vagas"
          type="circle"
          minzoom={13}
          filter={['==', ['geometry-type'], 'Point']}
          layout={{ visibility }}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 17, 6],
            'circle-color': colors.bicicletario,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 1.5,
          }}
        />
      </GeoJSONSource>
    </>
  );
}

/** Lugares do mapa base, das categorias ligadas: ponto colorido e nome a partir do zoom 15. */
export function PlaceLayers({ kinds }: { kinds: readonly PlaceKind[] }) {
  const { name, colors: theme } = useTheme();
  const colors = PLACE_COLORS[name];
  const subclasses = placeSubclasses(kinds);
  const visibility = subclasses.length > 0 ? 'visible' : 'none';
  const colorBySubclass = PLACE_KINDS.flatMap((kind) => kind.subclasses.flatMap((subclass) => [subclass, colors[kind.id]]));
  const filter = ['in', ['get', 'subclass'], ['literal', subclasses.length > 0 ? subclasses : ['-']]] as FilterSpecification;

  return (
    <>
      <Layer
        id={PLACE_LAYER}
        type="circle"
        source={BASE_SOURCE}
        source-layer="poi"
        minzoom={13}
        filter={filter}
        layout={{ visibility }}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 4, 17, 7],
          'circle-color': ['match', ['get', 'subclass'], ...colorBySubclass, theme.gold] as unknown as string,
          'circle-stroke-color': theme.background,
          'circle-stroke-width': 1.5,
        }}
      />
      <Layer
        id="lugares-nome"
        type="symbol"
        source={BASE_SOURCE}
        source-layer="poi"
        minzoom={15}
        filter={filter}
        layout={{
          visibility,
          'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-max-width': 8,
        }}
        paint={{ 'text-color': theme.textSecondary, 'text-halo-color': theme.background, 'text-halo-width': 1.2 }}
      />
    </>
  );
}

type RouteLineProps = {
  id: string;
  points: readonly RoutePoint[];
  color: string;
  /** Rota a seguir fica tracejada; o percurso feito, contínuo. */
  dashed?: boolean;
  width?: number;
};

/** Traço de uma rota ou de um percurso, com um halo leve para destacar sobre o mapa. */
export function RouteLine({ id, points, color, dashed = false, width = 4 }: RouteLineProps) {
  return (
    <GeoJSONSource id={id} data={points.length >= 2 ? routeShape(points) : EMPTY_SHAPE}>
      <Layer
        id={`${id}-halo`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': color, 'line-width': width * 3, 'line-opacity': 0.18 }}
      />
      <Layer
        id={`${id}-traco`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': color, 'line-width': width, ...(dashed ? { 'line-dasharray': [2, 1.5] } : {}) }}
      />
    </GeoJSONSource>
  );
}
