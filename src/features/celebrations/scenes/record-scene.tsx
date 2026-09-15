import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Halo } from '@/components/motion/halo';
import { LaurelCrown } from '@/components/motion/laurel-crown';
import { Reveal } from '@/components/motion/reveal';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { RollingNumber } from '@/components/motion/rolling-number';
import { Sparks } from '@/components/motion/sparks';
import { AppText } from '@/components/ui/text';
import * as haptics from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

import type { Celebration } from '../celebration-types';

import { Overline, RippleRing, WeightPlate } from './ceremony-parts';
import { SceneFrame } from './scene-frame';

const PLATE = 168;
const LANDING = 900;

const kg = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function decimalSuffix(value: number): string {
  const tenths = Math.round((value - Math.floor(value)) * 10);
  return tenths > 0 && tenths < 10 ? `,${tenths} kg` : ' kg';
}

type Props = { celebration: Extract<Celebration, { kind: 'record' }>; onContinue: () => void };

/** Recorde pessoal: a anilha gira até parar, a carga rola do recorde antigo ao novo e os louros coroam. */
export function RecordScene({ celebration, onContinue }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const spin = useSharedValue(reduced ? 1 : 0);
  const gain = Math.max(0, celebration.current - celebration.previous);

  useEffect(() => {
    if (reduced) {
      haptics.success();
      return;
    }
    spin.set(withDelay(150, withTiming(1, { duration: LANDING - 150, easing: Easing.bezier(0.16, 1, 0.3, 1) })));
    const timer = setTimeout(() => haptics.ceremony(), LANDING - 120);
    return () => {
      clearTimeout(timer);
      haptics.cancelCeremony();
      cancelAnimation(spin);
    };
  }, [reduced, spin]);

  const plateStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, spin.get() * 3),
    transform: [{ rotate: `${(spin.get() - 1) * 240}deg` }, { scale: 0.7 + 0.3 * spin.get() }],
  }));

  return (
    <SceneFrame
      layout="full"
      announcement={`Recorde pessoal em ${celebration.exercise}: ${kg.format(celebration.current)} quilos, ${kg.format(gain)} a mais que o anterior.`}
      onSkip={onContinue}
      actions={[{ label: 'Continuar', onPress: onContinue }]}
      actionsDelay={1700}>
      <Overline text="RECORDE PESSOAL" delay={950} />
      <Reveal delay={1000}>
        <AppText variant="heading" style={styles.center}>
          {celebration.exercise}
        </AppText>
      </Reveal>
      <View style={styles.stage}>
        <Halo size={340} strength={0.28} style={{ top: (PLATE - 340) / 2, left: (PLATE - 340) / 2 }} />
        <RippleRing size={PLATE} delay={LANDING - 60} />
        <Sparks size={360} count={32} seed={Math.round(celebration.current)} delay={LANDING - 80} style={{ top: (PLATE - 360) / 2, left: (PLATE - 360) / 2 }} />
        <LaurelCrown size={250} delay={LANDING + 80} style={{ top: (PLATE - 250) / 2, left: (PLATE - 250) / 2 }} />
        <Animated.View style={plateStyle}>
          <WeightPlate size={PLATE} />
        </Animated.View>
      </View>
      {/* Os dígitos inteiros rolam; a casa decimal (anilhas de 0,5 kg) entra fixa no sufixo. */}
      <RollingNumber
        value={Math.floor(celebration.current)}
        from={Math.floor(celebration.previous)}
        suffix={decimalSuffix(celebration.current)}
        variant="display"
        tone="goldHighlight"
        delay={LANDING}
        accessibilityLabel={`${kg.format(celebration.current)} quilos`}
      />
      <Reveal delay={LANDING + 380} style={[styles.chip, { borderColor: colors.gold, backgroundColor: colors.selectedFill }]}>
        <AppText variant="button" tone="goldHighlight" style={styles.tabular}>
          {`+${kg.format(gain)} kg`}
        </AppText>
      </Reveal>
      <Reveal delay={LANDING + 480}>
        <AppText variant="label" tone="muted" style={[styles.center, styles.tabular]}>
          {`Recorde anterior: ${kg.format(celebration.previous)} kg`}
        </AppText>
      </Reveal>
    </SceneFrame>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: PLATE,
    height: PLATE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.xl,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  center: {
    textAlign: 'center',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
