import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RankMedallion } from '@/components/rank/rank-medallion';
import { Button, tapFeedback } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { rankFromGlory } from '@/features/ranks/tiers';
import {
  DURATION,
  INTENSITIES,
  WORKOUT_TYPES,
  intensityLabel,
  stepDuration,
  type IntensityId,
  type WorkoutTypeId,
} from '@/features/workouts/workout-types';
import { fetchMyProgress, logWorkout } from '@/features/workouts/workouts-api';
import type { LoggedWorkout } from '@/features/workouts/workouts-parsers';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

const FALLBACK = { type: 'musculacao' as WorkoutTypeId, durationMin: 45, intensity: 'moderado' as IntensityId };

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

function ResultLine({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.resultLine}>
      <AppText tone="secondary">{label}</AppText>
      <AppText variant="bodyMedium" tone="goldHighlight" style={styles.tabular}>{`+${value}`}</AppText>
    </View>
  );
}

function WorkoutResult({ result, intensity, onClose }: { result: LoggedWorkout; intensity: IntensityId; onClose: () => void }) {
  const before = rankFromGlory(Math.max(0, result.totalGlory - result.points));
  const after = rankFromGlory(result.totalGlory);
  const ascended = !result.replayed && after.label !== before.label;

  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      {ascended ? (
        <View style={styles.ascension}>
          <RankMedallion tier={after.tierId} size={120} accessibilityLabel={`Novo rank: ${after.label}`} />
          <AppText variant="overline" tone="gold">Ascensão</AppText>
          <AppText variant="heading">{`Agora você é ${after.label}`}</AppText>
        </View>
      ) : null}

      {result.replayed ? (
        <>
          <AppText variant="heading">Treino já registrado</AppText>
          <Notice message="Este registro já tinha chegado ao servidor. Nada foi somado de novo." />
        </>
      ) : result.isScored ? (
        <>
          <AppText variant="display" tone="goldHighlight" style={styles.tabular}>{`+${result.points}`}</AppText>
          <AppText variant="subheading">de Glória</AppText>
          <View style={styles.breakdown}>
            <ResultLine label="Presença" value={result.presence} />
            <ResultLine label="Duração" value={result.duration} />
            <ResultLine label={`Intensidade (${intensityLabel(intensity)})`} value={result.intensity} />
            {result.bonus > 0 ? <ResultLine label="Constância: 3º treino da semana" value={result.bonus} /> : null}
          </View>
        </>
      ) : (
        <>
          <AppText variant="heading">Treino registrado</AppText>
          <Notice message="Você já tem 2 treinos pontuados hoje. Este fica no seu histórico, sem Glória." />
        </>
      )}

      <AppText tone="secondary" style={styles.tabular}>
        {`Glória da semana: ${result.weekGlory} · Acumulada: ${result.totalGlory}`}
      </AppText>
      <Button label="Fechar" onPress={onClose} />
    </View>
  );
}

/** RF006: registrar treino em até 3 toques (tipo → Concluí), com o último treino já preenchido. */
export default function RegisterWorkoutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const progress = useQuery({ queryKey: queryKeys.progress, queryFn: fetchMyProgress });

  // Os padrões repetem o último treino já conhecido: o fluxo comum é tocar no tipo e em "Concluí".
  const [initial] = useState(() => progress.data?.lastWorkout ?? FALLBACK);
  const [type, setType] = useState<WorkoutTypeId>(initial.type);
  const [minutes, setMinutes] = useState<number>(initial.durationMin);
  const [intensity, setIntensity] = useState<IntensityId>(initial.intensity);
  // Um identificador por registro: reenviar depois de uma falha de rede não pontua duas vezes.
  const [requestId, setRequestId] = useState(() => randomUUID());

  const save = useMutation({
    mutationFn: () => logWorkout({ requestId, type, durationMin: minutes, intensity }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
    },
  });

  function change(apply: () => void) {
    apply();
    // Dados diferentes são outro registro; o identificador antigo ficaria em conflito no servidor.
    if (save.isError) {
      setRequestId(randomUUID());
      save.reset();
    }
  }

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceRaised }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="heading">Registrar treino</AppText>
          {!save.isSuccess ? <AppText variant="label" tone="muted">Toque no tipo e depois em Concluí.</AppText> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={close} style={styles.close}>
          <Icon name="fechar" size={22} color={colors.gold} strokeWidth={1.6} />
        </Pressable>
      </View>

      {save.isSuccess ? (
        <WorkoutResult result={save.data} intensity={intensity} onClose={close} />
      ) : (
        <>
          <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Tipo de treino">
            {WORKOUT_TYPES.map((option) => {
              const selected = option.id === type;
              const color = selected ? colors.goldHighlight : colors.textSecondary;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: selected, disabled: save.isPending }}
                  disabled={save.isPending}
                  onPress={() => {
                    tapFeedback();
                    change(() => setType(option.id));
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
              <AppText variant="caption" tone="muted">
                {progress.data?.lastWorkout ? 'Igual ao último treino' : 'Ajuste se precisar'}
              </AppText>
            </View>
            <View style={styles.stepper}>
              <StepButton
                icon="menos"
                label="Diminuir 5 minutos"
                disabled={save.isPending || minutes <= DURATION.min}
                onPress={() => change(() => setMinutes((value) => stepDuration(value, -1)))}
              />
              <AppText variant="bodyMedium" style={styles.minutes} accessibilityLiveRegion="polite">{`${minutes} min`}</AppText>
              <StepButton
                icon="mais"
                label="Aumentar 5 minutos"
                disabled={save.isPending || minutes >= DURATION.max}
                onPress={() => change(() => setMinutes((value) => stepDuration(value, 1)))}
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
                    accessibilityState={{ checked: selected, disabled: save.isPending }}
                    disabled={save.isPending}
                    onPress={() => {
                      tapFeedback();
                      change(() => setIntensity(option.id));
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
            label={save.isPending ? 'Registrando…' : save.isError ? 'Tentar de novo' : 'Concluí'}
            icon="check"
            onPress={() => save.mutate()}
            disabled={save.isPending}
          />
          {save.isError ? <Notice tone="danger" message={errorMessage(save.error)} /> : null}
        </>
      )}
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
  result: {
    alignItems: 'center',
    gap: space.md,
  },
  ascension: {
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.md,
  },
  breakdown: {
    alignSelf: 'stretch',
    gap: space.xs,
    marginVertical: space.sm,
  },
  resultLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
