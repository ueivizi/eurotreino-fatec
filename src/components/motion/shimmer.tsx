import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { easing } from '@/theme/motion';

import { useReducedMotionPreference } from './reduced-motion';

type Props = {
  /** Raio do recorte (ex.: metade do diâmetro para o medalhão). */
  radius?: number;
  /** Pausa entre uma passada e outra, em ms. */
  interval?: number;
  /** Espera antes da primeira passada, em ms. */
  delay?: number;
  /** Quantas passadas; `infinite` repete enquanto estiver na tela. */
  repeat?: number | 'infinite';
  /** Cor do reflexo no meio da faixa. */
  color?: string;
};

const SWEEP_MS = 1100;

/**
 * "Brilho": uma faixa de luz atravessa a superfície de ouro. Cobre o pai inteiro (que precisa de
 * `position: relative`, padrão no React Native) e não recebe toques. Some com "reduzir movimento".
 */
export function Shimmer({ radius = 0, interval = 7000, delay = 1200, repeat = 'infinite', color = 'rgba(255,246,220,0.55)' }: Props) {
  const reduced = useReducedMotionPreference();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced || size.width === 0) return;
    const sweep = withSequence(
      withTiming(1, { duration: SWEEP_MS, easing: easing.inOut }),
      // Volta ao início fora da área visível, então o salto não aparece.
      withDelay(interval, withTiming(0, { duration: 0 })),
    );
    progress.set(withDelay(delay, withRepeat(sweep, repeat === 'infinite' ? -1 : repeat, false)));
    return () => cancelAnimation(progress);
  }, [reduced, size.width, interval, delay, repeat, progress]);

  const band = Math.max(36, size.width * 0.42);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -band * 1.4 + (size.width + band * 2.8) * progress.get() }, { skewX: '-18deg' }],
  }));

  if (reduced) return null;

  return (
    <View
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', pointerEvents: 'none' }]}>
      {size.width > 0 ? (
        <Animated.View style={[{ position: 'absolute', top: -size.height * 0.2, width: band, height: size.height * 1.4 }, bandStyle]}>
          <LinearGradient
            colors={['rgba(255,246,220,0)', color, 'rgba(255,246,220,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
