import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { between, seededRandom } from './seeded-random';
import { useReducedMotionPreference } from './reduced-motion';

type Shape = 'diamond' | 'dot' | 'leaf';

type Particle = {
  angle: number;
  distance: number;
  size: number;
  gravity: number;
  spin: number;
  /** Fração da animação em que a partícula começa (0 a 0,25). */
  start: number;
  color: string;
  shape: Shape;
};

const GOLD = ['#E6C878', '#C9A24A', '#F2D98A', '#FFF3C4'];

function makeParticles(seed: number, count: number, radius: number, colors: readonly string[]): Particle[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const roll = random();
    const shape: Shape = roll < 0.5 ? 'diamond' : roll < 0.82 ? 'dot' : 'leaf';
    return {
      // Espalha por igual e sacode um pouco: nada de buracos no leque.
      angle: (index / count) * Math.PI * 2 + between(random, -0.22, 0.22),
      distance: radius * between(random, 0.45, 1),
      size: between(random, 3, shape === 'leaf' ? 5 : 7),
      gravity: radius * between(random, 0.12, 0.32),
      spin: between(random, -220, 220),
      start: between(random, 0, 0.25),
      color: colors[Math.floor(random() * colors.length)] ?? GOLD[0],
      shape,
    };
  });
}

function Spark({ particle, progress }: { particle: Particle; progress: SharedValue<number> }) {
  const { angle, distance, gravity, spin, start, shape, size, color } = particle;
  const height = shape === 'leaf' ? size * 2.2 : size;

  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.get() - start) / (1 - start)));
    const out = 1 - Math.pow(1 - t, 3);
    const x = Math.cos(angle) * distance * out;
    const y = Math.sin(angle) * distance * out + gravity * t * t;
    const opacity = t === 0 ? 0 : t < 0.08 ? t / 0.08 : 1 - Math.max(0, (t - 0.45) / 0.55);
    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${(shape === 'diamond' ? 45 : 0) + spin * t}deg` },
        { scale: 1 - 0.45 * t },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.spark,
        {
          width: size,
          height,
          marginLeft: -size / 2,
          marginTop: -height / 2,
          backgroundColor: color,
          borderRadius: shape === 'diamond' ? 1 : size / 2,
        },
        style,
      ]}
    />
  );
}

type Props = {
  /** Lado da área da explosão; as partículas saem do centro. */
  size?: number;
  count?: number;
  /** Mesma semente, mesma explosão. Troque a semente (ou a `key`) para disparar outra. */
  seed?: number;
  delay?: number;
  duration?: number;
  colors?: readonly string[];
  style?: StyleProp<ViewStyle>;
};

/** "Faísca": partículas de ouro explodem do centro e caem com gravidade. Some com "reduzir movimento". */
export function Sparks({ size = 260, count = 28, seed = 7, delay = 0, duration = 1200, colors = GOLD, style }: Props) {
  const reduced = useReducedMotionPreference();
  const [particles] = useState(() => makeParticles(seed, count, size / 2, colors));
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.set(withDelay(delay, withTiming(1, { duration, easing: Easing.linear })));
    return () => cancelAnimation(progress);
  }, [reduced, delay, duration, progress]);

  if (reduced) return null;

  return (
    <View style={[styles.area, { width: size, height: size }, style]}>
      {particles.map((particle, index) => (
        <Spark key={index} particle={particle} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  spark: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
});
