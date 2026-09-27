import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

import { pointsShape, routeBounds, routeShape, type RoutePoint } from './route';

export const ROUTE_MAP_AVAILABLE = true;

/**
 * Estilos do OpenFreeMap: dados do OpenStreetMap, sem chave de API. O servidor de mapa recebe só o
 * endereço IP e a área que está na tela; o traçado nunca sai do aparelho.
 */
const MAP_STYLES = {
  onix: 'https://tiles.openfreemap.org/styles/dark',
  marmore: 'https://tiles.openfreemap.org/styles/positron',
} as const;

/** Sem GPS, o mapa abre no centro de São Paulo (fuso e público do app) ou no traçado carregado. */
const DEFAULT_CENTER: [number, number] = [-46.6333, -23.5505];

const EMPTY = { type: 'FeatureCollection' as const, features: [] };

type Props = {
  points: RoutePoint[];
  onAddPoint: (point: RoutePoint) => void;
  /** Traçado a enquadrar: muda quando uma rota salva é carregada. */
  frame: readonly RoutePoint[] | null;
};

/** Mapa de desenhar rota (quadro 8.4): cada toque vira um ponto do traçado. */
export function RouteMap({ points, onAddPoint, frame }: Props) {
  const { colors, name } = useTheme();
  const camera = useRef<CameraRef>(null);

  useEffect(() => {
    const bounds = frame ? routeBounds(frame) : null;
    if (!bounds) return;
    camera.current?.fitBounds(bounds, { padding: { top: 48, right: 48, bottom: 48, left: 48 }, duration: 600 });
  }, [frame]);

  return (
    <View style={styles.wrap}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLES[name]}
        logo={false}
        attribution={false}
        compass={false}
        touchRotate={false}
        touchPitch={false}
        onPress={(event) => {
          const [lng, lat] = event.nativeEvent.lngLat;
          onAddPoint({ lat, lng });
        }}>
        <Camera ref={camera} initialViewState={{ center: DEFAULT_CENTER, zoom: 12 }} />
        <GeoJSONSource id="rota" data={points.length >= 2 ? routeShape(points) : EMPTY}>
          <Layer
            id="rota-halo"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.gold, 'line-width': 12, 'line-opacity': 0.2 }}
          />
          <Layer
            id="rota-traco"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.goldHighlight, 'line-width': 4 }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="pontos" data={pointsShape(points)}>
          <Layer
            id="pontos-marca"
            type="circle"
            paint={{
              'circle-radius': ['case', ['get', 'first'], 7, 4],
              'circle-color': ['case', ['get', 'first'], colors.success, colors.goldHighlight],
              'circle-stroke-color': colors.background,
              'circle-stroke-width': 2,
            }}
          />
        </GeoJSONSource>
      </Map>
      {/* Crédito à vista, como pede a licença do OpenStreetMap; o estilo não traz o texto embutido. */}
      <View style={[styles.credit, { backgroundColor: colors.background }]} pointerEvents="none">
        <AppText variant="caption" tone="muted">© OpenStreetMap · OpenMapTiles · OpenFreeMap</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
  },
  credit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: space.xs,
    opacity: 0.85,
  },
});
