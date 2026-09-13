import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, tapFeedback } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { sampleMe } from '@/data/sample';
import {
  DURATION,
  INTENSITIES,
  WORKOUT_TYPES,
  stepDuration,
  type IntensityId,
  type WorkoutTypeId,
} from '@/features/workouts/workout-types';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

function StepButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.stepButton, { borderColor: colors.hairline, opacity: disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={18} color={colors.gold} strokeWidth={1.8} />
    </Pressable>
  );
}

export default function RegisterWorkoutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const last = sampleMe.lastWorkout;

  // Os padrões repetem o último treino: o fluxo comum é tocar no tipo e em "Concluí".
  const [type, setType] = useState<WorkoutTypeId>(last.type);
  const [minutes, setMinutes] = useState<number>(last.minutes);
  const [intensity, setIntensity] = useState<IntensityId>(last.intensity);
  const [notice, setNotice] = useState<string | null>(null);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceRaised }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="heading">Registrar treino</AppText>
          <AppText variant="label" tone="muted">Toque no tipo e depois em Concluí.</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={close} style={styles.close}>
          <Icon name="fechar" size={22} color={colors.gold} strokeWidth={1.6} />
        </Pressable>
      </View>

      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Tipo de treino">
        {WORKOUT_TYPES.map((option) => {
          const selected = option.id === type;
          const color = selected ? colors.goldHighlight : colors.textSecondary;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                tapFeedback();
                setType(option.id);
                setNotice(null);
              }}
              style={[
                styles.typeChip,
                {
                  backgroundColor: selected ? colors.selectedFill : colors.surface,
                  borderColor: selected ? colors.gold : colors.hairlineSoft,
                  borderWidth: selected ? 1.5 : 1,
                },
              ]}>
              <Icon name={option.icon} size={26} color={color} />
              <AppText variant="label" style={{ color }}>{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.durationRow}>
        <View style={styles.headerText}>
          <AppText variant="bodyMedium">Duração</AppText>
          <AppText variant="caption" tone="muted">Igual ao último treino</AppText>
        </View>
        <View style={styles.stepper}>
          <StepButton
            icon="menos"
            label="Diminuir 5 minutos"
            disabled={minutes <= DURATION.min}
            onPress={() => setMinutes((value) => stepDuration(value, -1))}
          />
          <AppText variant="bodyMedium" style={styles.minutes} accessibilityLiveRegion="polite">{`${minutes} min`}</AppText>
          <StepButton
            icon="mais"
            label="Aumentar 5 minutos"
            disabled={minutes >= DURATION.max}
            onPress={() => setMinutes((value) => stepDuration(value, 1))}
          />
        </View>
      </View>

      <View style={styles.intensity}>
        <AppText variant="bodyMedium">Intensidade</AppText>
        <View style={[styles.segmented, { borderColor: colors.hairline }]} accessibilityRole="radiogroup" accessibilityLabel="Intensidade">
          {INTENSITIES.map((option) => {
            const selected = option.id === intensity;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  tapFeedback();
                  setIntensity(option.id);
                }}
                style={[
                  styles.segment,
                  selected && { backgroundColor: colors.selectedFill, borderColor: colors.gold, borderWidth: 1 },
                ]}>
                <AppText variant={selected ? 'button' : 'body'} tone={selected ? 'goldHighlight' : 'secondary'}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button
        label="Concluí"
        icon="check"
        onPress={() =>
          setNotice('Prévia do fluxo: o registro será enviado ao servidor quando o app estiver ligado ao Supabase.')
        }
      />
      {notice ? (
        <View style={[styles.notice, { borderColor: colors.hairline }]} accessibilityRole="alert">
          <Icon name="info" size={18} color={colors.gold} />
          <AppText variant="label" tone="secondary" style={styles.noticeText}>{notice}</AppText>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.xxxl,
    gap: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: {
    flexShrink: 1,
    gap: space.xs,
  },
  close: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space.md,
    marginTop: -space.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.md,
  },
  typeChip: {
    width: '31.5%',
    height: 84,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  stepButton: {
    width: touchTarget,
    height: touchTarget,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minutes: {
    minWidth: 76,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  intensity: {
    gap: space.sm,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: touchTarget - 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  noticeText: {
    flex: 1,
  },
});
