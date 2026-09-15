import { StyleSheet, View } from 'react-native';

import { Reveal } from '@/components/motion/reveal';
import { RollingNumber } from '@/components/motion/rolling-number';
import { AppText } from '@/components/ui/text';
import { space } from '@/theme/tokens';

import type { Celebration } from '../celebration-types';

import { Torch } from './ceremony-parts';
import { SceneFrame } from './scene-frame';

type Props = { celebration: Extract<Celebration, { kind: 'constancy' }>; onContinue: () => void };

/** Constância: o 3º treino pontuado da semana acende as três tochas. */
export function ConstancyScene({ celebration, onContinue }: Props) {
  return (
    <SceneFrame
      layout="card"
      announcement={`Constância: mais ${celebration.bonus} de Glória pelo terceiro treino da semana.`}
      onSkip={onContinue}
      actions={[{ label: 'Continuar', onPress: onContinue }]}
      actionsDelay={1250}>
      <View style={styles.torches}>
        <Torch lit delay={150} />
        <Torch lit delay={420} size={72} />
        <Torch lit delay={690} />
      </View>
      <Reveal delay={860}>
        <AppText variant="overline" tone="gold" style={styles.center}>
          Constância
        </AppText>
      </Reveal>
      <View style={styles.bonus}>
        <RollingNumber value={celebration.bonus} from={0} prefix="+" variant="display" tone="goldHighlight" delay={900} />
        <AppText variant="subheading" style={styles.label}>
          de Glória
        </AppText>
      </View>
      <Reveal delay={1050}>
        <AppText tone="secondary" style={styles.center}>
          Três treinos nesta semana. A constância rende Glória extra.
        </AppText>
      </Reveal>
    </SceneFrame>
  );
}

const styles = StyleSheet.create({
  torches: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: space.lg,
    marginBottom: space.sm,
  },
  bonus: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  label: {
    marginTop: space.lg,
  },
  center: {
    textAlign: 'center',
  },
});
