import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme';
import { radius as radii } from '@/theme/tokens';

import { useReducedMotionPreference } from './reduced-motion';

const pulse = css.keyframes({
  from: { opacity: 0.4 },
  to: { opacity: 0.85 },
});

type Props = {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Esqueleto de carregamento: a forma do conteúdo respirando, no lugar do spinner. */
export function Skeleton({ width, height, radius = radii.md, style }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  return (
    <Animated.View
      aria-hidden
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.track },
        style,
        reduced
          ? { opacity: 0.6 }
          : {
              animationName: pulse,
              animationDuration: 900,
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
              animationTimingFunction: 'ease-in-out',
            },
      ]}
    />
  );
}
