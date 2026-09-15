import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { css, cubicBezier } from 'react-native-reanimated';

import { Halo } from '@/components/motion/halo';
import { Reveal } from '@/components/motion/reveal';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { Sparks } from '@/components/motion/sparks';
import { RankMedallion } from '@/components/rank/rank-medallion';
import { AppText } from '@/components/ui/text';
import * as haptics from '@/lib/haptics';
import { fonts, space } from '@/theme/tokens';

import type { Celebration } from '../celebration-types';

import { Ribbon, RippleRing } from './ceremony-parts';
import { SceneFrame } from './scene-frame';

const MEDAL = 128;
const GLOW = 250;

const standardCurve = cubicBezier(0.2, 0, 0, 1);

const mint = css.keyframes({
  '0%': { opacity: 0, transform: [{ scale: 1.28 }] },
  '60%': { opacity: 1, transform: [{ scale: 0.97 }] },
  '100%': { opacity: 1, transform: [{ scale: 1 }] },
});

const leave = css.keyframes({
  from: { opacity: 1, transform: [{ translateY: 0 }] },
  to: { opacity: 0, transform: [{ translateY: -16 }] },
});

const arrive = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 16 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
});

/** Numeral da fita trocando: o antigo sobe e some, o novo chega por baixo. */
function NumeralSwap({ from, to, delay }: { from: string; to: string; delay: number }) {
  const reduced = useReducedMotionPreference();
  const text = { fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 22, letterSpacing: 1.6, color: '#0B0A08' };
  return (
    <View style={styles.swap}>
      {reduced ? null : (
        <Animated.Text
          aria-hidden
          style={[text, styles.swapText, { animationName: leave, animationDuration: 260, animationDelay: delay, animationFillMode: 'both' }]}>
          {from}
        </Animated.Text>
      )}
      <Animated.Text
        style={[
          text,
          styles.swapText,
          reduced ? null : { animationName: arrive, animationDuration: 320, animationDelay: delay + 140, animationTimingFunction: standardCurve, animationFillMode: 'both' },
        ]}>
        {to}
      </Animated.Text>
    </View>
  );
}

type Props = { celebration: Extract<Celebration, { kind: 'division' }>; onContinue: () => void };

/** Nova divisão: conquista menor, cartão central com o medalhão cunhado de novo. */
export function DivisionScene({ celebration, onContinue }: Props) {
  const reduced = useReducedMotionPreference();
  const { next } = celebration;

  useEffect(() => {
    const timer = setTimeout(() => haptics.success(), reduced ? 0 : 260);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <SceneFrame
      layout="card"
      announcement={`Nova divisão: ${celebration.label}.`}
      onSkip={onContinue}
      actions={[{ label: 'Continuar', onPress: onContinue }]}
      actionsDelay={950}>
      <View style={styles.stage}>
        <Halo size={GLOW} strength={0.26} style={{ top: (MEDAL - GLOW) / 2, left: (MEDAL - GLOW) / 2 }} />
        <RippleRing size={MEDAL} delay={300} />
        <Sparks size={GLOW} count={18} seed={celebration.glory} delay={280} duration={1000} style={{ top: (MEDAL - GLOW) / 2, left: (MEDAL - GLOW) / 2 }} />
        <Animated.View style={reduced ? null : { animationName: mint, animationDuration: 460, animationDelay: 100, animationTimingFunction: standardCurve, animationFillMode: 'backwards' }}>
          <RankMedallion tier={celebration.tier} size={MEDAL} accessibilityLabel={`Medalhão de ${celebration.label}`} />
        </Animated.View>
      </View>

      <View style={styles.ribbon}>
        <Ribbon label="" width={84} delay={220} />
        <View style={StyleSheet.absoluteFill}>
          <NumeralSwap from={celebration.fromDivision} to={celebration.division} delay={520} />
        </View>
      </View>

      <Reveal delay={560}>
        <AppText variant="overline" tone="gold" style={styles.center}>
          Nova divisão
        </AppText>
      </Reveal>
      <Reveal delay={620}>
        <AppText variant="heading" style={styles.center}>
          {celebration.label}
        </AppText>
      </Reveal>
      {next ? (
        <Reveal delay={700}>
          <AppText tone="secondary" style={[styles.center, styles.tabular]}>
            {`Faltam ${next.remaining} para ${next.label}.`}
          </AppText>
        </Reveal>
      ) : null}
    </SceneFrame>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: MEDAL,
    height: MEDAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbon: {
    width: 84,
    height: 30,
    marginTop: -space.xl,
    marginBottom: space.xs,
  },
  swap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapText: {
    position: 'absolute',
  },
  center: {
    textAlign: 'center',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
