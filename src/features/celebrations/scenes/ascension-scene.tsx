import { StyleSheet, View } from 'react-native';

import { Halo } from '@/components/motion/halo';
import { LightRays } from '@/components/motion/light-rays';
import { Reveal } from '@/components/motion/reveal';
import { Sparks } from '@/components/motion/sparks';
import { AppText } from '@/components/ui/text';
import { ascensionShareMessage } from '@/features/workouts/share-workout';
import { shareText } from '@/lib/share';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

import type { Celebration } from '../celebration-types';
import { mottoFor } from '../mottos';

import { CoinFlip, Overline, Ribbon, RippleRing } from './ceremony-parts';
import { SceneFrame } from './scene-frame';

const STAGE = 208;
const RAYS = 460;
const HALO = 380;

type Props = { celebration: Extract<Celebration, { kind: 'ascension' }>; onContinue: () => void };

/**
 * Ascensão (≈2 s): raios acendem, a moeda do rank antigo gira e revela o novo, a cunhagem
 * solta faíscas, e só então vêm o nome, o lema e a Glória.
 */
export function AscensionScene({ celebration, onContinue }: Props) {
  const { colors } = useTheme();
  const motto = mottoFor(celebration.toTier);
  const { next } = celebration;

  return (
    <SceneFrame
      layout="full"
      announcement={`Ascensão. Agora você é ${celebration.label}, com ${celebration.glory} de Glória.`}
      onSkip={onContinue}
      actions={[
        { label: 'Continuar', onPress: onContinue },
        {
          label: 'Compartilhar',
          variant: 'ghost' as const,
          onPress: () => void shareText(ascensionShareMessage(celebration.glory)),
        },
      ]}
      actionsDelay={1950}>
      <Overline text="ASCENSÃO" delay={1100} />

      <View style={styles.stage}>
        <LightRays size={RAYS} delay={150} style={centered(RAYS)} />
        <Halo size={HALO} strength={0.34} style={centered(HALO)} />
        <RippleRing size={STAGE * 0.8} delay={1300} />
        <Sparks size={RAYS} count={36} seed={celebration.toTier * 11} delay={1290} duration={1300} style={centered(RAYS)} />
        <CoinFlip
          fromTier={celebration.fromTier}
          toTier={celebration.toTier}
          size={STAGE}
          delay={520}
          accessibilityLabel={`Medalhão de ${celebration.tierName}`}
        />
      </View>

      {celebration.division ? (
        <View style={styles.ribbon}>
          <Ribbon label={celebration.division} delay={1380} />
        </View>
      ) : null}

      <Reveal delay={1460}>
        <AppText variant="display" style={styles.center}>
          {celebration.tierName}
        </AppText>
      </Reveal>

      {motto ? (
        <Reveal delay={1580} style={styles.motto}>
          <AppText variant="motto" tone="goldHighlight" style={styles.center}>
            {motto.latin}
          </AppText>
          <AppText variant="label" tone="muted" style={styles.center}>
            {motto.translation}
          </AppText>
        </Reveal>
      ) : null}

      <Reveal delay={1720} style={[styles.card, { backgroundColor: 'rgba(21,18,14,0.85)', borderColor: colors.hairlineSoft }]}>
        <AppText tone="secondary" style={styles.center}>
          {'Você chegou a '}
          <AppText variant="bodyMedium" tone="goldHighlight" style={styles.tabular}>
            {String(celebration.glory)}
          </AppText>
          {' de Glória.'}
        </AppText>
        {next ? (
          <AppText variant="label" tone="muted" style={[styles.center, styles.tabular]}>
            {`Próxima divisão: ${next.label}, com ${next.min}.`}
          </AppText>
        ) : null}
        <AppText variant="label" tone="success" style={styles.center}>
          Sua Glória nunca é perdida.
        </AppText>
      </Reveal>
    </SceneFrame>
  );
}

function centered(size: number) {
  return { top: (STAGE - size) / 2, left: (STAGE - size) / 2 };
}

const styles = StyleSheet.create({
  stage: {
    width: STAGE,
    height: STAGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  ribbon: {
    marginTop: -space.xxxl,
  },
  center: {
    textAlign: 'center',
  },
  motto: {
    alignItems: 'center',
    gap: 2,
  },
  card: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    gap: space.sm,
    marginTop: space.sm,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
