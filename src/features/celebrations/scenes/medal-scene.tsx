import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Halo } from '@/components/motion/halo';
import { Reveal } from '@/components/motion/reveal';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { Shimmer } from '@/components/motion/shimmer';
import { Sparks } from '@/components/motion/sparks';
import { useSvgId } from '@/components/motion/svg-id';
import type { IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import * as haptics from '@/lib/haptics';
import { spring } from '@/theme/motion';
import { space } from '@/theme/tokens';

import { MedalDisc, Overline } from './ceremony-parts';
import { SceneFrame } from './scene-frame';

const RIBBON = 104;
const MEDAL = 148;
const DROP_MS = 150;
const LAND_MS = 720;

/** Fita em V de pórfiro com bordas de ouro, presa no topo da cena. */
function MedalRibbon() {
  const id = useSvgId('fita-medalha');
  return (
    <Svg width={120} height={RIBBON} viewBox={`0 0 120 ${RIBBON}`}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3E1636" />
          <Stop offset="1" stopColor="#6E2F5E" />
        </LinearGradient>
      </Defs>
      <Path d={`M6 0 H44 L74 ${RIBBON} H48 Z`} fill={`url(#${id})`} />
      <Path d={`M76 0 H114 L72 ${RIBBON} H46 Z`} fill={`url(#${id})`} opacity={0.92} />
      <Path d={`M14 0 L54 ${RIBBON} M36 0 L66 ${RIBBON} M106 0 L66 ${RIBBON} M84 0 L54 ${RIBBON}`} stroke="#C9A24A" strokeWidth={1.6} />
    </Svg>
  );
}

type Props = {
  title: string;
  description: string;
  icon: IconName;
  onContinue: () => void;
};

/**
 * Medalha conquistada: desce presa na fita, balança como pêndulo até parar e ganha um brilho.
 * Serve ao primeiro treino e às conquistas que o servidor liberar.
 */
export function MedalScene({ title, description, icon, onContinue }: Props) {
  const reduced = useReducedMotionPreference();
  const drop = useSharedValue(reduced ? 0 : -420);
  const swing = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      haptics.success();
      return;
    }
    drop.set(withDelay(DROP_MS, withSpring(0, { damping: 15, stiffness: 120, mass: 1 })));
    // O pêndulo começa torto e a mola de pouco amortecimento o faz balançar até parar.
    swing.set(withDelay(DROP_MS + 260, withSequence(withTiming(13, { duration: 260 }), withSpring(0, spring.pendulum))));
    const timer = setTimeout(() => haptics.ceremony(), DROP_MS + LAND_MS - 200);
    return () => {
      clearTimeout(timer);
      haptics.cancelCeremony();
      cancelAnimation(drop);
      cancelAnimation(swing);
    };
  }, [reduced, drop, swing]);

  const pendulum = useAnimatedStyle(() => ({
    transform: [{ translateY: drop.get() }, { rotate: `${swing.get()}deg` }],
  }));

  return (
    <SceneFrame
      layout="full"
      announcement={`Medalha conquistada: ${title}. ${description}`}
      onSkip={onContinue}
      actions={[{ label: 'Continuar', onPress: onContinue }]}
      actionsDelay={1600}>
      <View style={styles.stage}>
        <Halo size={320} strength={0.3} style={{ top: RIBBON + MEDAL / 2 - 160, left: (180 - 320) / 2 }} />
        <Sparks size={320} count={28} seed={title.length * 13} delay={DROP_MS + LAND_MS - 180} style={{ top: RIBBON + MEDAL / 2 - 160, left: (180 - 320) / 2 }} />
        {/* O pivô do pêndulo fica no topo da fita. */}
        <Animated.View style={[styles.pendulum, { transformOrigin: '50% 0%' }, pendulum]}>
          <MedalRibbon />
          <View style={styles.medal}>
            <MedalDisc size={MEDAL} icon={icon} />
            <Shimmer radius={MEDAL / 2} delay={DROP_MS + LAND_MS + 500} interval={5200} repeat={2} />
          </View>
        </Animated.View>
      </View>
      <Overline text="MEDALHA" delay={1000} />
      <Reveal delay={1120}>
        <AppText variant="title" style={styles.center}>
          {title}
        </AppText>
      </Reveal>
      <Reveal delay={1260}>
        <AppText tone="secondary" style={styles.center}>
          {description}
        </AppText>
      </Reveal>
    </SceneFrame>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 180,
    height: RIBBON + MEDAL,
    alignItems: 'center',
    marginBottom: space.md,
  },
  pendulum: {
    alignItems: 'center',
  },
  medal: {
    width: MEDAL,
    height: MEDAL,
    marginTop: -14,
    borderRadius: MEDAL / 2,
  },
  center: {
    textAlign: 'center',
  },
});
