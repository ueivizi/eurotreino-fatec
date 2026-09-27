import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { formatDistance } from '@/features/workouts/metrics';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

import { recordFix, useTrack } from './gps-store';
import { signalQuality } from './gps-track';

export const GPS_AVAILABLE = true;

type Status = 'ativo' | 'negado' | 'erro';

/** Ponto que pulsa enquanto o GPS grava; parado com "reduzir movimento". */
function Pulse({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!active || reduced) {
      opacity.set(1);
      return;
    }
    opacity.set(withRepeat(withTiming(0.25, { duration: 900 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [active, reduced, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.pulse, { backgroundColor: active ? colors.success : colors.textMuted }, style]} />;
}

/**
 * GPS da sessão de resistência: grava o percurso com o app aberto e mostra a distância. Só existe
 * com a escolha "GPS no treino" ligada. O trajeto fica no aparelho.
 */
export function GpsTracker({ sessionKey, paused }: { sessionKey: string; paused: boolean }) {
  const { colors } = useTheme();
  const { track, accuracy } = useTrack(sessionKey);
  const [status, setStatus] = useState<Status>('ativo');

  useEffect(() => {
    if (paused) return;
    let alive = true;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        if (alive) setStatus('negado');
        return;
      }
      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 },
        (location) =>
          recordFix(sessionKey, {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy ?? null,
            at: location.timestamp,
          }),
      );
      if (alive) {
        subscription = watcher;
        setStatus('ativo');
      } else {
        watcher.remove();
      }
    })().catch(() => {
      if (alive) setStatus('erro');
    });

    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [sessionKey, paused]);

  const quality = signalQuality(accuracy);
  const message =
    status === 'negado'
      ? 'A localização está bloqueada no celular. Libere para o EuroTreino nas configurações do aparelho.'
      : status === 'erro'
        ? 'O GPS não respondeu. A distância pode ser informada no fim.'
        : paused
          ? 'Pausado junto com o treino.'
          : track.points.length === 0
            ? 'Buscando sinal… fique a céu aberto.'
            : quality === 'fraco'
              ? 'Sinal fraco: os trechos imprecisos ficam de fora.'
              : 'Gravando o percurso neste aparelho.';

  return (
    <Card style={styles.card} accessible accessibilityLabel={`GPS: ${formatDistance(Math.round(track.distanceM))}. ${message}`}>
      <View style={styles.row}>
        <Icon name="local" size={20} color={colors.gold} />
        <AppText variant="overline" tone="gold" style={styles.flex}>GPS</AppText>
        <Pulse active={status === 'ativo' && !paused} />
      </View>
      <AppText variant="stat" tone="goldHighlight" style={styles.tabular}>{formatDistance(Math.round(track.distanceM))}</AppText>
      <AppText variant="caption" tone={status === 'ativo' ? 'muted' : 'danger'}>{message}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  pulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  flex: {
    flex: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
