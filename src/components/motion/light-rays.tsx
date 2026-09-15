import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { css } from 'react-native-reanimated';
import Svg, { Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { useReducedMotionPreference } from './reduced-motion';
import { useSvgId } from './svg-id';

const turn = css.keyframes({
  from: { transform: [{ rotate: '0deg' }] },
  to: { transform: [{ rotate: '360deg' }] },
});

const appear = css.keyframes({
  from: { opacity: 0, transform: [{ scale: 0.6 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
});

type Props = {
  size: number;
  rays?: number;
  color?: string;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/** "Raios": leque de luz que gira devagar atrás do medalhão. Com "reduzir movimento", fica parado. */
export function LightRays({ size, rays = 14, color = '#E6C878', delay = 0, style }: Props) {
  const reduced = useReducedMotionPreference();
  const id = useSvgId('raios');
  const c = size / 2;
  const half = (Math.PI / rays) * 0.42;

  const wedges = Array.from({ length: rays }, (_, index) => {
    const angle = (index / rays) * Math.PI * 2;
    const x1 = c + Math.cos(angle - half) * c;
    const y1 = c + Math.sin(angle - half) * c;
    const x2 = c + Math.cos(angle + half) * c;
    const y2 = c + Math.sin(angle + half) * c;
    return `M${c} ${c} L${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
  });

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, pointerEvents: 'none' },
        style,
        reduced
          ? { opacity: 0.7 }
          : {
              animationName: [appear, turn],
              animationDuration: [700, 28000],
              animationDelay: [delay, delay],
              animationIterationCount: [1, 'infinite'],
              animationTimingFunction: ['ease-out', 'linear'],
              animationFillMode: ['backwards', 'none'],
            },
      ]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.5} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.14} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G fill={`url(#${id})`}>
          {wedges.map((d) => (
            <Path key={d} d={d} />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}
