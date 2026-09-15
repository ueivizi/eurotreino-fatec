import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { css } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useReducedMotionPreference } from './reduced-motion';
import { useSvgId } from './svg-id';

const breathe = css.keyframes({
  from: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  to: { opacity: 1, transform: [{ scale: 1.04 }] },
});

type Props = {
  size: number;
  color?: string;
  /** Opacidade no centro do brilho. */
  strength?: number;
  /** Respiração lenta (3,6 s). Desligada com "reduzir movimento". */
  breathing?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Halo de luz dourada atrás do medalhão. Posicione pelo `style` (fica absoluto e sem toque). */
export function Halo({ size, color = '#D4AF37', strength = 0.3, breathing = true, style }: Props) {
  const reduced = useReducedMotionPreference();
  const id = useSvgId('halo');
  const animate = breathing && !reduced;

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, pointerEvents: 'none' },
        style,
        animate
          ? {
              animationName: breathe,
              animationDuration: 3600,
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
              animationTimingFunction: 'ease-in-out',
            }
          : null,
      ]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={strength} />
            <Stop offset="0.38" stopColor={color} stopOpacity={strength / 3} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
