import { useEffect } from 'react';
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
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { useSvgId } from '@/components/motion/svg-id';
import { Icon } from '@/components/ui/icon';
import type { EmblemColor, EmblemName } from '@/features/profile/emblems';
import { duration, easing } from '@/theme/motion';

/** Pano do estandarte: a cor escolhida em tom de tecido, mais escuro embaixo (quadro 2.1). */
export const BANNER_CLOTH: Record<EmblemColor, { top: string; bottom: string; ink: string }> = {
  porfiro: { top: '#6E2F5E', bottom: '#4A1E40', ink: '#E6C878' },
  ouro: { top: '#8A6A24', bottom: '#5C4614', ink: '#F3ECDD' },
  bronze: { top: '#8C5A2B', bottom: '#5E3A1A', ink: '#E6C878' },
  prata: { top: '#6A7075', bottom: '#43484C', ink: '#E6C878' },
  oliva: { top: '#5F6E2E', bottom: '#3C471B', ink: '#E6C878' },
  terracota: { top: '#9E4A33', bottom: '#6A2E1F', ink: '#E6C878' },
};

const GOLD = '#C9A24A';
const GOLD_LIGHT = '#E6C878';

/** Proporção do desenho original: 96 × 124, com o pano de y = 14 a y = 118. */
const VIEW_W = 96;
const VIEW_H = 124;
const CLOTH_TOP = 14;
const CLOTH_H = 104;

type Props = {
  emblem: EmblemName;
  color: EmblemColor;
  /** Largura em pontos; a altura segue a proporção do estandarte. */
  width?: number;
  /** O pano desce da travessa ao aparecer. */
  unfurl?: boolean;
  /** Balanço leve e contínuo, como pano ao vento. */
  sway?: boolean;
  /** Atraso do desenrolar, em ms. */
  delay?: number;
};

/**
 * Estandarte da Legião: travessa de ouro, pano na cor escolhida com ponta em V e o emblema no
 * centro. Com "reduzir movimento", aparece parado e inteiro.
 */
export function LegionBanner({ emblem, color, width = 104, unfurl = true, sway = true, delay = 0 }: Props) {
  const reduced = useReducedMotionPreference();
  const gradient = useSvgId('pano');
  const cloth = BANNER_CLOTH[color];
  const scale = width / VIEW_W;
  const height = VIEW_H * scale;

  const drop = useSharedValue(reduced || !unfurl ? 1 : 0);
  const swing = useSharedValue(0);

  useEffect(() => {
    if (reduced || !unfurl) {
      drop.set(1);
      return;
    }
    drop.set(0);
    drop.set(withDelay(delay, withTiming(1, { duration: duration.reveal + 200, easing: easing.standard })));
  }, [reduced, unfurl, delay, drop, emblem, color]);

  useEffect(() => {
    if (reduced || !sway) {
      swing.set(0);
      return;
    }
    swing.set(
      withDelay(
        delay + duration.reveal,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 2600, easing: easing.inOut }),
            withTiming(-1, { duration: 2600, easing: easing.inOut }),
          ),
          -1,
          true,
        ),
      ),
    );
    return () => cancelAnimation(swing);
  }, [reduced, sway, delay, swing]);

  const clothStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.get() * 2),
    transform: [{ scaleY: 0.02 + drop.get() * 0.98 }, { skewX: `${swing.get() * 1.8}deg` }],
  }));

  const iconSize = 36 * scale;

  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Travessa e haste: ficam paradas, o pano é que mexe. */}
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={StyleSheet.absoluteFill}>
        <Path d="M48 1 V10" stroke={GOLD} strokeWidth={2} />
        <Path d="M6 10 H90" stroke={GOLD} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={6} cy={10} r={4} fill={GOLD} />
        <Circle cx={90} cy={10} r={4} fill={GOLD} />
      </Svg>

      <Animated.View
        style={[
          { position: 'absolute', left: 0, top: CLOTH_TOP * scale, width, height: CLOTH_H * scale, transformOrigin: 'top' },
          clothStyle,
        ]}>
        <Svg width={width} height={CLOTH_H * scale} viewBox={`0 ${CLOTH_TOP} ${VIEW_W} ${CLOTH_H}`}>
          <Defs>
            <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={cloth.top} />
              <Stop offset="1" stopColor={cloth.bottom} />
            </LinearGradient>
          </Defs>
          <Path d="M14 14 H82 V104 L48 118 L14 104 Z" fill={`url(#${gradient})`} stroke={GOLD} strokeWidth={1.5} />
          <Path d="M20 20 H76 V100 L48 111 L20 100 Z" fill="none" stroke={GOLD_LIGHT} strokeOpacity={0.45} strokeWidth={1} />
        </Svg>
        <View style={[styles.emblem, { top: (60 - CLOTH_TOP) * scale - iconSize / 2, left: width / 2 - iconSize / 2 }]}>
          <Icon name={emblem} size={iconSize} color={cloth.ink} strokeWidth={1.3} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  emblem: {
    position: 'absolute',
  },
});
