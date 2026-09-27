import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
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
  /**
   * Para medidas que nunca caem (Glória, Honra): se o valor diminuiu, o nível virou, então a barra
   * completa e recomeça. Sem isso, a barra só anda até o novo ponto.
   */
  wrapOnDecrease?: boolean;
};

function clamp(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Barra de progresso que enche com a curva padrão; quando o valor muda, anda até o novo ponto. */
export function ProgressBar({ value, accessibilityLabel, gainFrom, delay = 0, wrapOnDecrease = false }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const target = clamp(value);
  const hasGain = gainFrom !== undefined && clamp(gainFrom) < target;
  const start = hasGain ? clamp(gainFrom) : 0;

  const fill = useSharedValue(reduced ? target : start);
  const gain = useSharedValue(reduced ? target : start);
  // Ponto em que a barra parou por último; só é lido e gravado dentro do efeito.
  const shown = useRef(reduced ? target : start);

  useEffect(() => {
    const from = shown.current;
    shown.current = target;
    if (reduced) {
      fill.set(target);
      gain.set(target);
      return;
    }
    const config = { duration: duration.slow + 240, easing: easing.standard };
    const wraps = wrapOnDecrease && !hasGain && target < from - 0.001;
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
  }, [target, hasGain, delay, reduced, wrapOnDecrease, fill, gain]);

  // Largura em porcentagem da trilha. Antes a barra se deslocava pela largura medida, e o estilo
  // inicial era calculado com largura 0: a barra aparecia cheia até a próxima mudança de valor.
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  const gainStyle = useAnimatedStyle(() => ({ width: `${gain.get() * 100}%` }));

  const percent = Math.round(target * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[styles.track, { backgroundColor: colors.track }]}>
      {hasGain ? <Animated.View style={[styles.bar, { backgroundColor: '#F2D98A' }, gainStyle]} /> : null}
      <Animated.View style={[styles.bar, fillStyle]}>
        <LinearGradient
          colors={[colors.goldDeep, colors.gold, colors.goldHighlight]}
          locations={[0, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});
