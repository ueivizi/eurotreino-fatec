import { Camera, GeoJSONSource, Layer, Map, NativeUserLocation, type CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

import { CyclewayLayers } from './map-layers';
import { DEFAULT_CENTER, EMPTY_SHAPE, MAP_CREDIT, MAP_STYLES } from './map-style';
import { pointsShape, routeBounds, routeShape, type RoutePoint } from './route';

export const ROUTE_MAP_AVAILABLE = true;

type Props = {
  points: RoutePoint[];
  onAddPoint: (point: RoutePoint) => void;
  /** Traçado a enquadrar: muda quando uma rota salva é carregada. */
  frame: readonly RoutePoint[] | null;
  /** Posição da pessoa (com a escolha "Localização" ligada): o mapa abre nela e mostra o ponto. */
  myPosition?: RoutePoint | null;
};

/** Mapa de desenhar rota (quadro 8.4): cada toque vira um ponto do traçado. */
export function RouteMap({ points, onAddPoint, frame, myPosition = null }: Props) {
  const { colors, name } = useTheme();
  const camera = useRef<CameraRef>(null);
  const centered = useRef(false);

  useEffect(() => {
    const bounds = frame ? routeBounds(frame) : null;
    if (!bounds) return;
    centered.current = true;
    camera.current?.fitBounds(bounds, { padding: { top: 48, right: 48, bottom: 48, left: 48 }, duration: 600 });
  }, [frame]);

  // Sem rota carregada, o desenho começa de onde a pessoa está.
  useEffect(() => {
    if (!myPosition || centered.current) return;
    centered.current = true;
    camera.current?.flyTo({ center: [myPosition.lng, myPosition.lat], zoom: 15, duration: 600 });
  }, [myPosition]);

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
        <CyclewayLayers visible />
        <GeoJSONSource id="rota" data={points.length >= 2 ? routeShape(points) : EMPTY_SHAPE}>
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
        {myPosition ? <NativeUserLocation /> : null}
      </Map>
      {/* Crédito à vista, como pede a licença do OpenStreetMap; o estilo não traz o texto embutido. */}
      <View style={[styles.credit, { backgroundColor: colors.background }]} pointerEvents="none">
        <AppText variant="caption" tone="muted">{`${MAP_CREDIT} · CET/SP`}</AppText>
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
