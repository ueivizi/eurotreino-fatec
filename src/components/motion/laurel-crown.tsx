import { useEffect } from 'react';
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

import { useReducedMotionPreference } from './reduced-motion';

export const LAUREL_TONES = {
  gold: { leaf: '#D9B55A', rim: '#E6C878' },
  silver: { leaf: '#B9BDC1', rim: '#C3C7CB' },
  bronze: { leaf: '#B97A48', rim: '#C98A55' },
} as const;

export type LaurelTone = keyof typeof LAUREL_TONES;

/** Tempo entre uma folha e a seguinte, em ms. */
const LEAF_STEP = 55;
const LEAF_GROW = 320;

type LeafProps = {
  index: number;
  angle: number;
  tilt: number;
  radius: number;
  width: number;
  height: number;
  color: string;
  progress: SharedValue<number>;
};

function Leaf({ index, angle, tilt, radius, width, height, color, progress }: LeafProps) {
  const style = useAnimatedStyle(() => {
    // `progress` anda em ms: cada folha cresce na sua vez, com um leve passo além do tamanho final.
    const t = Math.min(1, Math.max(0, (progress.get() - index * LEAF_STEP) / LEAF_GROW));
    const back = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
    return {
      opacity: t === 0 ? 0 : Math.min(1, t * 3),
      transform: [{ rotate: `${angle}deg` }, { translateY: -radius }, { rotate: `${tilt}deg` }, { scale: t === 0 ? 0 : back }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.leaf,
        { width, height, marginLeft: -width / 2, marginTop: -height / 2, borderRadius: width / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

type Props = {
  size: number;
  tone?: LaurelTone;
  delay?: number;
  /** Folhas de cada lado. */
  leaves?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * "Coroar": folhas de louro surgem de baixo para cima, dos dois lados, em volta de um emblema.
 * Mesma geometria dos louros estáticos do pódio. Com "reduzir movimento", a coroa já aparece pronta.
 */
export function LaurelCrown({ size, tone = 'gold', delay = 0, leaves = 7, style }: Props) {
  const reduced = useReducedMotionPreference();
  const total = leaves * LEAF_STEP + LEAF_GROW;
  const progress = useSharedValue(reduced ? total : 0);

  useEffect(() => {
    if (reduced) {
      progress.set(total);
      return;
    }
    progress.set(withDelay(delay, withTiming(total, { duration: total, easing: Easing.linear })));
    return () => cancelAnimation(progress);
  }, [reduced, delay, total, progress]);

  const radius = size * 0.42;
  const width = size * 0.064;
  const height = size * 0.14;
  // Com 7 folhas, 15° entre elas: a mesma coroa aberta no topo dos louros estáticos.
  const step = leaves > 1 ? 90 / (leaves - 1) : 0;
  const color = LAUREL_TONES[tone].leaf;

  const items = Array.from({ length: leaves }, (_, index) => [
    { key: `e-${index}`, index, angle: 204 + index * step, tilt: -24 },
    { key: `d-${index}`, index, angle: 156 - index * step, tilt: 24 },
  ]).flat();

  return (
    <View style={[{ position: 'absolute', width: size, height: size, pointerEvents: 'none' }, style]}>
      {items.map((item) => (
        <Leaf
          key={item.key}
          index={item.index}
          angle={item.angle}
          tilt={item.tilt}
          radius={radius}
          width={width}
          height={height}
          color={color}
          progress={progress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  leaf: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
});
