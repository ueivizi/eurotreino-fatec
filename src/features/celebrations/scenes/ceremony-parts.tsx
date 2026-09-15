import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  css,
  cubicBezier,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinearGradient, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';

import { Reveal } from '@/components/motion/reveal';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { useSvgId } from '@/components/motion/svg-id';
import { RankMedallion } from '@/components/rank/rank-medallion';
import { Icon, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import type { TierId } from '@/features/ranks/tiers';
import * as haptics from '@/lib/haptics';
import { spring } from '@/theme/motion';
import { useTheme } from '@/theme/theme';
import { fonts, goldGradient, space } from '@/theme/tokens';

const standardCurve = cubicBezier(0.2, 0, 0, 1);

/** Título curto em versalete com filetes dos dois lados (ex.: ASCENSÃO). */
export function Overline({ text, delay = 0 }: { text: string; delay?: number }) {
  const { colors } = useTheme();
  return (
    <Reveal delay={delay} style={styles.overline}>
      <View style={[styles.overlineRule, { backgroundColor: colors.hairlineStrong }]} />
      <AppText style={[styles.overlineText, { color: colors.goldHighlight }]}>{text}</AppText>
      <View style={[styles.overlineRule, { backgroundColor: colors.hairlineStrong }]} />
    </Reveal>
  );
}

const ripple = css.keyframes({
  from: { opacity: 0.9, transform: [{ scale: 0.72 }] },
  to: { opacity: 0, transform: [{ scale: 1.75 }] },
});

/** Anel que se expande e some: o impacto da cunhagem. */
export function RippleRing({ size, delay = 0, color = '#E6C878', style }: { size: number; delay?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotionPreference();
  if (reduced) return null;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
          pointerEvents: 'none',
          opacity: 0,
          animationName: ripple,
          animationDuration: 760,
          animationDelay: delay,
          animationTimingFunction: standardCurve,
          animationFillMode: 'both',
        },
        style,
      ]}
    />
  );
}

/** Fita de ouro com o numeral da divisão, como no medalhão cunhado. */
export function Ribbon({ label, delay = 0, width = 96 }: { label: string; delay?: number; width?: number }) {
  const id = useSvgId('fita');
  const { colors } = useTheme();
  const height = 30;
  const notch = width * 0.08;
  return (
    <Reveal delay={delay} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {goldGradient.colors.map((color, index) => (
              <Stop key={index} offset={goldGradient.locations[index]} stopColor={color} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Polygon
          points={`0,0 ${width},0 ${width - notch},${height / 2} ${width},${height} 0,${height} ${notch},${height / 2}`}
          fill={`url(#${id})`}
        />
      </Svg>
      <AppText style={[styles.ribbonText, { color: colors.onGold }]}>{label}</AppText>
    </Reveal>
  );
}

type CoinFlipProps = {
  fromTier: TierId;
  toTier: TierId;
  size: number;
  /** Quando a moeda começa a girar, em ms. */
  delay: number;
  accessibilityLabel: string;
};

/** A moeda do rank antigo gira e revela o novo; no fim, a cunhagem dá um pequeno salto. */
export function CoinFlip({ fromTier, toTier, size, delay, accessibilityLabel }: CoinFlipProps) {
  const reduced = useReducedMotionPreference();
  const flip = useSharedValue(reduced ? 1 : 0);
  const bump = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      haptics.success();
      return;
    }
    flip.set(
      withDelay(
        delay,
        withTiming(1, { duration: 780, easing: Easing.bezier(0.45, 0, 0.2, 1) }, (finished) => {
          'worklet';
          if (finished) bump.set(withSequence(withTiming(1.1, { duration: 110 }), withSpring(1, spring.pop)));
        }),
      ),
    );
    const timer = setTimeout(() => haptics.ceremony(), delay + 520);
    return () => {
      clearTimeout(timer);
      haptics.cancelCeremony();
      cancelAnimation(flip);
      cancelAnimation(bump);
    };
  }, [reduced, delay, flip, bump]);

  const front = useAnimatedStyle(() => {
    const value = flip.get();
    return {
      opacity: value < 0.5 ? 1 : 0,
      transform: [{ perspective: 900 }, { rotateY: `${value * 180}deg` }, { scale: bump.get() }],
    };
  });

  const back = useAnimatedStyle(() => {
    const value = flip.get();
    return {
      opacity: value >= 0.5 ? 1 : 0,
      transform: [{ perspective: 900 }, { rotateY: `${(value - 1) * 180}deg` }, { scale: bump.get() }],
    };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View aria-hidden style={[StyleSheet.absoluteFill, front]}>
        <RankMedallion tier={fromTier} size={size} accessibilityLabel="" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, back]}>
        <RankMedallion tier={toTier} size={size} accessibilityLabel={accessibilityLabel} />
      </Animated.View>
    </View>
  );
}

const reveal = css.keyframes({
  from: { width: 0 },
  to: { width: 34 },
});

const stamp = css.keyframes({
  '0%': { opacity: 0, transform: [{ scale: 1.35 }] },
  '55%': { opacity: 1, transform: [{ scale: 0.96 }] },
  '100%': { opacity: 1, transform: [{ scale: 1 }] },
});

/** "Cunhar": o selo de ouro bate na tela e o check se desenha da esquerda para a direita. */
export function StampCheck({ size = 72, delay = 0 }: { size?: number; delay?: number }) {
  const reduced = useReducedMotionPreference();
  const { colors } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => haptics.success(), reduced ? 0 : delay + 160);
    return () => clearTimeout(timer);
  }, [reduced, delay]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <RippleRing size={size} delay={delay + 180} />
      <Animated.View
        style={[
          { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
          reduced ? null : { animationName: stamp, animationDuration: 460, animationDelay: delay, animationTimingFunction: standardCurve, animationFillMode: 'backwards' },
        ]}>
        <LinearGradient
          colors={goldGradient.colors}
          locations={goldGradient.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* O check é revelado por uma máscara que cresce: funciona igual no celular e na Web. */}
        <Animated.View
          style={[
            { height: 34, width: 34, overflow: 'hidden', zIndex: 1 },
            reduced ? null : { animationName: reveal, animationDuration: 320, animationDelay: delay + 200, animationTimingFunction: 'ease-out', animationFillMode: 'backwards' },
          ]}>
          <View style={{ width: 34, height: 34 }}>
            <Icon name="check" size={34} color={colors.onGold} strokeWidth={2.2} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const flicker = css.keyframes({
  from: { transform: [{ scaleY: 0.92 }, { scaleX: 1.03 }] },
  to: { transform: [{ scaleY: 1.06 }, { scaleX: 0.97 }] },
});

/** "Tocha": braseiro que acende com uma chama viva. */
export function Torch({ lit, delay = 0, size = 64 }: { lit: boolean; delay?: number; size?: number }) {
  const reduced = useReducedMotionPreference();
  const id = useSvgId('chama');
  const glowId = useSvgId('brilho');
  const flame = useSharedValue(lit && reduced ? 1 : 0);

  useEffect(() => {
    if (!lit) return;
    if (reduced) {
      flame.set(1);
      return;
    }
    flame.set(withDelay(delay, withSpring(1, spring.pop)));
    const timer = setTimeout(() => haptics.tap(), delay);
    return () => {
      clearTimeout(timer);
      cancelAnimation(flame);
    };
  }, [lit, reduced, delay, flame]);

  const flameStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, flame.get() * 1.6),
    transform: [{ translateY: (1 - flame.get()) * 10 }, { scale: flame.get() }],
  }));

  const height = size * 1.25;

  return (
    <View style={{ width: size, height, alignItems: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, flameStyle]}>
        <Svg width={size} height={height} viewBox="0 0 64 80" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={glowId} cx="50%" cy="42%" r="50%">
              <Stop offset="0" stopColor="#E6C878" stopOpacity={0.45} />
              <Stop offset="1" stopColor="#E6C878" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={32} cy={34} r={30} fill={`url(#${glowId})`} />
        </Svg>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            // A chama oscila a partir da base, não do meio.
            { transformOrigin: '50% 65%' },
            reduced
              ? null
              : {
                  animationName: flicker,
                  animationDuration: 620,
                  animationDelay: delay,
                  animationIterationCount: 'infinite',
                  animationDirection: 'alternate',
                  animationTimingFunction: 'ease-in-out',
                },
          ]}>
          <Svg width={size} height={height} viewBox="0 0 64 80">
            <Defs>
              <SvgLinearGradient id={id} x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#8A6A24" />
                <Stop offset="0.45" stopColor="#C9A24A" />
                <Stop offset="1" stopColor="#F2D98A" />
              </SvgLinearGradient>
            </Defs>
            <Path d="M32 8 C40 18 46 26 46 36 C46 46 40 52 32 52 C24 52 18 46 18 36 C18 28 24 22 27 14 C28 20 30 23 32 24 C33 18 33 13 32 8 Z" fill={`url(#${id})`} />
            <Path d="M32 26 C36 31 39 35 39 40 C39 45 36 48 32 48 C28 48 25 45 25 41 C25 37 28 34 30 30 C31 33 32 34 33 34 C33 31 33 29 32 26 Z" fill="#FFF3C4" opacity={0.9} />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Svg width={size} height={height} viewBox="0 0 64 80" style={StyleSheet.absoluteFill}>
        <G fill="none" stroke={lit ? '#C9A24A' : 'rgba(201,162,74,0.35)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M14 54 H50 L44 64 H20 Z" />
          <Path d="M26 64 L23 76 M38 64 L41 76 M32 64 V76 M20 76 H44" />
        </G>
      </Svg>
    </View>
  );
}

/** Anilha de ferro com aro de ouro, para o recorde pessoal. */
export function WeightPlate({ size }: { size: number }) {
  const id = useSvgId('anilha');
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Defs>
        <RadialGradient id={id} cx="38%" cy="32%" r="80%">
          <Stop offset="0" stopColor="#4A4540" />
          <Stop offset="0.55" stopColor="#1C1A18" />
          <Stop offset="1" stopColor="#050505" />
        </RadialGradient>
      </Defs>
      <Circle cx={70} cy={70} r={66} fill="#C9A24A" />
      <Circle cx={70} cy={70} r={62} fill={`url(#${id})`} />
      <Circle cx={70} cy={70} r={50} fill="none" stroke="rgba(230,200,120,0.35)" strokeWidth={1.2} />
      <Circle cx={70} cy={70} r={38} fill="none" stroke="rgba(230,200,120,0.22)" strokeWidth={6} />
      <Circle cx={70} cy={70} r={16} fill="#0B0A08" stroke="#C9A24A" strokeWidth={2.5} />
      <G fill="#E6C878">
        {Array.from({ length: 12 }, (_, index) => {
          const angle = (index / 12) * Math.PI * 2;
          return <Circle key={index} cx={70 + Math.cos(angle) * 57} cy={70 + Math.sin(angle) * 57} r={1.4} />;
        })}
      </G>
    </Svg>
  );
}

/** Face da medalha: disco de ouro com contas no aro e um ícone em relevo. */
export function MedalDisc({ size, icon }: { size: number; icon: IconName }) {
  const id = useSvgId('medalha');
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 140 140" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="36%" cy="30%" r="80%">
            <Stop offset="0" stopColor="#FBEAB0" />
            <Stop offset="0.5" stopColor="#D4AF37" />
            <Stop offset="1" stopColor="#7A5A17" />
          </RadialGradient>
        </Defs>
        <Circle cx={70} cy={70} r={66} fill="#6B4E14" />
        <Circle cx={70} cy={70} r={61} fill={`url(#${id})`} />
        <Circle cx={70} cy={70} r={54} fill="none" stroke="#7A5A17" strokeWidth={2.6} strokeDasharray="0.1 5.6" strokeLinecap="round" />
        <G fill="#8A6A24" opacity={0.85}>
          {Array.from({ length: 6 }, (_, index) => [
            <Ellipse key={`e${index}`} cx={70} cy={70} rx={2.6} ry={6} transform={`rotate(${212 + index * 13} 70 70) translate(0 -44) rotate(-24 70 70)`} />,
            <Ellipse key={`d${index}`} cx={70} cy={70} rx={2.6} ry={6} transform={`rotate(${148 - index * 13} 70 70) translate(0 -44) rotate(24 70 70)`} />,
          ])}
        </G>
      </Svg>
      {/* zIndex explícito: na Web o SVG absoluto seria pintado por cima do ícone. */}
      <View style={{ zIndex: 1 }}>
        <Icon name={icon} size={size * 0.34} color="#5E4410" strokeWidth={2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  overlineRule: {
    width: 36,
    height: 1,
  },
  overlineText: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 3.2,
  },
  ribbonText: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1.6,
  },
});
