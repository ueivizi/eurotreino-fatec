import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/** Etapas do primeiro acesso (quadros 1.3 a 1.5): um filete por etapa, em ouro até a atual. */
export function StepProgress({ step, total }: { step: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Etapa ${step} de ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.segment, { backgroundColor: index < step ? colors.gold : colors.hairlineSoft }]} />
      ))}
      <AppText variant="caption" tone="muted" style={styles.label}>{`${step} de ${total}`}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  segment: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  label: {
    marginLeft: space.sm,
    fontVariant: ['tabular-nums'],
  },
});
