import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { css, cubicBezier } from 'react-native-reanimated';

import { duration, staggerDelay } from '@/theme/motion';

import { useReducedMotionPreference } from './reduced-motion';

/** "Ascender": o conteúdo sobe 12 px enquanto aparece. */
const rise = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 12 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
});

const fade = css.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const standardCurve = cubicBezier(0.2, 0, 0, 1);

type Props = {
  /** Posição na cascata: cada item entra 45 ms depois do anterior (até 8). */
  index?: number;
  /** Atraso antes do primeiro item, em ms. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Entrada em cascata ao montar. Com "reduzir movimento", só um fade curto e sem atraso. */
export function Reveal({ index = 0, delay = 0, style, children }: Props) {
  const reduced = useReducedMotionPreference();
  return (
    <Animated.View
      style={[
        style,
        {
          animationName: reduced ? fade : rise,
          animationDuration: reduced ? duration.fast : duration.base,
          animationDelay: reduced ? 0 : staggerDelay(index, delay),
          animationTimingFunction: standardCurve,
          animationFillMode: 'backwards',
        },
      ]}>
      {children}
    </Animated.View>
  );
}
