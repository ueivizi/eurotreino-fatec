import { Camera, Map, NativeUserLocation, type CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { formatDistance } from '@/features/workouts/metrics';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

import { useTrack } from './gps-store';
import { CyclewayLayers, RouteLine } from './map-layers';
import { DEFAULT_CENTER, MAP_CREDIT, MAP_STYLES } from './map-style';
import { routeBounds, routeDistanceM, routeProgress, type RoutePoint } from './route';

export const LIVE_MAP_AVAILABLE = true;

/** Longe assim do traçado, a pessoa saiu da rota (a precisão do GPS na cidade anda perto de 20 m). */
const OFF_ROUTE_M = 60;

type Props = {
  sessionKey: string;
  /** Rota escolhida para seguir, desenhada tracejada por baixo do percurso. */
  route: readonly RoutePoint[] | null;
  /** Com a escolha "Localização" ligada: ponto da pessoa e câmera que acompanha. */
  showPosition: boolean;
};

/**
 * Mapa ao vivo da sessão de resistência: a posição, o percurso feito (em ouro) e a rota a seguir.
 * O percurso vem do mesmo GPS que mede a distância, então nada é lido duas vezes.
 */
export function LiveMap({ sessionKey, route, showPosition }: Props) {
  const { colors, name } = useTheme();
  const { track } = useTrack(sessionKey);
  const camera = useRef<CameraRef>(null);
  const [follow, setFollow] = useState(true);

  // Sem posição, a câmera enquadra a rota inteira.
  useEffect(() => {
    if (showPosition || !route) return;
    const bounds = routeBounds(route);
    if (bounds) camera.current?.fitBounds(bounds, { padding: { top: 32, right: 32, bottom: 32, left: 32 }, duration: 0 });
  }, [route, showPosition]);

  const last = track.points[track.points.length - 1] ?? null;
  const progress = route && last ? routeProgress(last, route) : null;
  const first = route?.[0];
  const status = !route
    ? null
    : !progress
      ? `Rota de ${formatDistance(routeDistanceM(route))}`
      : progress.offRouteM > OFF_ROUTE_M
        ? `Fora da rota · ${formatDistance(progress.offRouteM)}`
        : `Faltam ${formatDistance(progress.remainingM)}`;

  return (
    <View style={[styles.wrap, { borderColor: colors.hairlineSoft }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLES[name]}
        logo={false}
        attribution={false}
        compass={false}
        touchPitch={false}
        touchRotate={false}>
        <Camera
          ref={camera}
          initialViewState={{ center: first ? [first.lng, first.lat] : DEFAULT_CENTER, zoom: 15 }}
          trackUserLocation={showPosition && follow ? 'course' : undefined}
          onTrackUserLocationChange={(event) => {
            if (event.nativeEvent.trackUserLocation === null) setFollow(false);
          }}
        />
        <CyclewayLayers visible />
        {route ? <RouteLine id="rota-plano" points={route} color={colors.textSecondary} dashed width={3} /> : null}
        <RouteLine id="percurso" points={track.points} color={colors.goldHighlight} />
        {showPosition ? <NativeUserLocation mode="course" /> : null}
      </Map>

      {status ? (
        <View
          style={[styles.status, { backgroundColor: colors.surfaceRaised, borderColor: progress && progress.offRouteM > OFF_ROUTE_M ? colors.danger : colors.hairline }]}
          accessibilityLiveRegion="polite">
          <AppText variant="label" tone={progress && progress.offRouteM > OFF_ROUTE_M ? 'danger' : 'primary'} style={styles.tabular}>{status}</AppText>
        </View>
      ) : null}

      {showPosition && !follow ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Voltar a seguir sua posição"
          onPress={() => setFollow(true)}
          style={[styles.follow, { backgroundColor: colors.surfaceRaised, borderColor: colors.gold }]}>
          <Icon name="mira" size={20} color={colors.goldHighlight} />
        </PressableScale>
      ) : null}

      <View style={[styles.credit, { backgroundColor: colors.background }]} pointerEvents="none">
        <AppText variant="caption" tone="muted">{MAP_CREDIT}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 260,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  status: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  follow: {
    position: 'absolute',
    right: space.sm,
    bottom: space.xl,
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  credit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: space.xs,
    opacity: 0.85,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
