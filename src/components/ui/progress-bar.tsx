import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { duration, easing } from '@/theme/motion';
import { useTheme } from '@/theme/theme';

type Props = {
  /** De 0 a 1. Valores fora disso (ou inválidos) são limitados. */
  value: number;
  accessibilityLabel: string;
  /**
   * Onde a barra estava antes de uma conquista (0 a 1). O trecho ganho aparece em ouro claro
   * e depois se funde ao preenchimento.
   */
  gainFrom?: number;
  /** Atraso da animação, em ms. */
  delay?: number;
};

function clamp(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Barra de progresso que enche com a curva padrão; quando o valor muda, anda até o novo ponto. */
export function ProgressBar({ value, accessibilityLabel, gainFrom, delay = 0 }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const [width, setWidth] = useState(0);
  const target = clamp(value);
  const hasGain = gainFrom !== undefined && clamp(gainFrom) < target;
  const start = hasGain ? clamp(gainFrom) : 0;

  const fill = useSharedValue(reduced ? target : start);
  const gain = useSharedValue(reduced ? target : start);
  // Ponto em que a barra parou por último; só é lido e gravado dentro do efeito.
  const shown = useRef(reduced ? target : start);

  useEffect(() => {
    if (width === 0) return;
    const from = shown.current;
    shown.current = target;
    if (reduced) {
      fill.set(target);
      gain.set(target);
      return;
    }
    const config = { duration: duration.slow + 240, easing: easing.standard };
    // A Glória nunca cai: se o valor diminuiu, a divisão virou. A barra completa e recomeça.
    const wraps = !hasGain && target < from - 0.001;
    const run = (to: number) =>
      wraps
        ? withSequence(withTiming(1, config), withTiming(0, { duration: 0 }), withTiming(to, config))
        : withTiming(to, config);
    gain.set(withDelay(delay, run(target)));
    // Com ganho, o ouro principal alcança o trecho novo um pouco depois: dá tempo de ver o que entrou.
    fill.set(withDelay(delay + (hasGain ? 900 : 0), run(target)));
    return () => {
      cancelAnimation(fill);
      cancelAnimation(gain);
    };
  }, [width, target, hasGain, delay, reduced, fill, gain]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(1 - fill.get()) * width }],
  }));

  const gainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(1 - gain.get()) * width }],
  }));

  const percent = Math.round(target * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.track }]}>
      {width > 0 ? (
        <>
          {hasGain ? <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#F2D98A' }, gainStyle]} /> : null}
          <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
            <LinearGradient
              colors={[colors.goldDeep, colors.gold, colors.goldHighlight]}
              locations={[0, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
