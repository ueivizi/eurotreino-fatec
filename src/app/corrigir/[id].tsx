import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button, tapFeedback } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/detail-row';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { NumberField } from '@/components/ui/number-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { FormScrollView } from '@/components/ui/form-scroll';
import { useProfile } from '@/features/auth/session';
import { workoutWarnings } from '@/features/workouts/coherence';
import { editWorkout, fetchHistoryWorkouts, type HistoryWorkout } from '@/features/workouts/history-api';
import { formatDistance, formatLoad } from '@/features/workouts/metrics';
import {
  DISTANCE,
  DURATION,
  INTENSITIES,
  LOAD,
  NOTE_MAX_LENGTH,
  SETS,
  WORKOUT_TYPES,
  workoutModule,
  type IntensityId,
  type WorkoutTypeId,
} from '@/features/workouts/workout-types';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Primeiro dia do mês corrente, no relógio do aparelho (igual aos Anais). */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function whenLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${WEEKDAYS[date.getDay()]}, ${day}/${month} às ${time}`;
}

type Draft = {
  type: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  distanceM: number | null;
  setsCount: number | null;
  loadKg: number | null;
  avgHeartRate: number | null;
  note: string;
};

function draftOf(workout: HistoryWorkout): Draft {
  return {
    type: workout.type,
    durationMin: workout.durationMin,
    intensity: workout.intensity,
    distanceM: workout.distanceM,
    setsCount: workout.setsCount,
    loadKg: workout.loadKg,
    avgHeartRate: workout.avgHeartRate,
    note: workout.note ?? '',
  };
}

/**
 * Corrigir um treino (RF014).
 *
 * Só o que o treino **foi**: modalidade, duração, intensidade e detalhes. O horário fica onde
 * está -- mudá-lo mudaria o dia, a semana, o teto diário e o bônus de constância, ou seja,
 * reescreveria a pontuação de toda a semana. Semana fechada o servidor recusa, e a tela diz por quê.
 */
function EditForm({ workout, month }: { workout: HistoryWorkout; month: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const healthConsent = profile?.healthConsentAt !== null && profile?.healthConsentAt !== undefined;

  const [form, setForm] = useState<Draft>(() => draftOf(workout));
  const module = workoutModule(form.type);

  // Cada detalhe só existe na família a que pertence: o servidor recusa o que estiver fora dela.
  const draft: Draft = {
    ...form,
    distanceM: module === 'forca' ? null : form.distanceM,
    setsCount: module === 'forca' ? form.setsCount : null,
    loadKg: module === 'forca' ? form.loadKg : null,
    note: module === 'outro' ? form.note.trim() : '',
    avgHeartRate: healthConsent ? form.avgHeartRate : null,
  };

  const change = (patch: Partial<Draft>) => setForm((current) => ({ ...current, ...patch }));

  const warnings = workoutWarnings({
    type: draft.type,
    durationMin: draft.durationMin,
    intensity: draft.intensity,
    distanceM: draft.distanceM,
    avgHeartRate: draft.avgHeartRate,
  });

  const save = useMutation({
    mutationFn: () =>
      editWorkout({
        id: workout.id,
        type: draft.type,
        durationMin: draft.durationMin,
        intensity: draft.intensity,
        ...(draft.distanceM === null ? {} : { distanceM: draft.distanceM }),
        ...(draft.setsCount === null ? {} : { setsCount: draft.setsCount }),
        ...(draft.loadKg === null ? {} : { loadKg: draft.loadKg }),
        ...(draft.avgHeartRate === null ? {} : { avgHeartRate: draft.avgHeartRate }),
        ...(draft.note === '' ? {} : { note: draft.note }),
      }),
    onSuccess: () => {
      // A Glória mudou: o mês, o Início, o Coliseu e os recordes voltam a perguntar ao servidor.
      for (const key of [queryKeys.history(month), queryKeys.historyMonths, queryKeys.progress, queryKeys.rankings, queryKeys.records]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      if (router.canGoBack()) router.back();
      else router.replace('/anais');
    },
  });

  const disabled = save.isPending;

  return (
    <>
      <Card style={styles.when}>
        <Icon name="relogio" size={20} color={colors.gold} />
        <View style={styles.flex}>
          <AppText variant="bodyMedium">{whenLabel(workout.performedAt)}</AppText>
          <AppText variant="caption" tone="muted">
            {workout.isScored ? `Vale ${workout.points} de Glória hoje` : 'Registrado sem Glória (teto do dia)'}
          </AppText>
        </View>
      </Card>

      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Tipo de treino">
        {WORKOUT_TYPES.map((option) => {
          const selected = option.id === form.type;
          const color = selected ? colors.goldHighlight : colors.textSecondary;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => {
                tapFeedback();
                change({ type: option.id });
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

      <View style={styles.row}>
        <View style={styles.headerText}>
          <AppText variant="bodyMedium">Duração</AppText>
          <AppText variant="caption" tone="muted">Muda a Glória do treino</AppText>
        </View>
        <NumberField
          label="Duração"
          value={form.durationMin}
          onChange={(value) => change({ durationMin: value })}
          min={DURATION.min}
          max={DURATION.max}
          step={DURATION.step}
          format={(value) => `${value} min`}
          disabled={disabled}
        />
      </View>

      <View style={styles.group}>
        <AppText variant="bodyMedium">Intensidade</AppText>
        <SegmentedControl
          options={INTENSITIES}
          value={form.intensity}
          onChange={(id) => change({ intensity: id })}
          accessibilityLabel="Intensidade"
          disabled={disabled}
        />
      </View>

      {/* Distância não existe na força: ninguém percorre quilômetro levantando peso. */}
      {module === 'forca' ? null : (
        <DetailRow
          label="Distância"
          hint="Não muda a Glória; entra no seu histórico e nos recordes"
          value={form.distanceM}
          format={formatDistance}
          step={DISTANCE.step}
          min={DISTANCE.step}
          max={DISTANCE.max}
          start={5000}
          disabled={disabled}
          onChange={(value) => change({ distanceM: value })}
        />
      )}

      {module === 'outro' ? (
        <TextField
          label="O que foi?"
          hint="Opcional. Ex.: futebol, pilates, escalada."
          value={form.note}
          onChangeText={(text) => change({ note: text })}
          placeholder="futebol"
          maxLength={NOTE_MAX_LENGTH}
          autoCapitalize="sentences"
          editable={!disabled}
          returnKeyType="done"
        />
      ) : null}

      {healthConsent ? (
        <DetailRow
          label="Frequência cardíaca média"
          hint="Dado de saúde: fica só com você, nunca vai para a Legião"
          value={form.avgHeartRate}
          format={(value) => `${value} bpm`}
          step={5}
          min={30}
          max={240}
          start={140}
          disabled={disabled}
          onChange={(value) => change({ avgHeartRate: value })}
        />
      ) : null}

      {module === 'forca' ? (
        <>
          <DetailRow
            label="Séries"
            hint="Quantas séries no total"
            value={form.setsCount}
            format={(value) => `${value}`}
            step={SETS.step}
            min={SETS.min}
            max={SETS.max}
            start={4}
            disabled={disabled}
            onChange={(value) => change({ setsCount: value })}
          />
          <DetailRow
            label="Carga principal"
            hint="Peso do exercício principal"
            value={form.loadKg}
            format={formatLoad}
            step={LOAD.step}
            min={LOAD.min}
            max={LOAD.max}
            start={20}
            decimals
            disabled={disabled}
            onChange={(value) => change({ loadKg: value })}
          />
        </>
      ) : null}

      {warnings.map((warning) => (
        <Notice key={warning} message={warning} />
      ))}

      <Button
        label={save.isPending ? 'Salvando…' : save.isError ? 'Tentar de novo' : 'Salvar correção'}
        icon="check"
        onPress={() => save.mutate()}
        disabled={disabled}
      />
      {save.isError ? <Notice tone="danger" message={errorMessage(save.error)} /> : null}

      <AppText variant="caption" tone="muted">
        A Glória é recalculada pela mesma regra de sempre. O horário, o bônus de constância e a Honra
        já conquistada não mudam.
      </AppText>
    </>
  );
}

/** RF014: corrigir um treino já registrado, a partir dos Anais. */
export default function EditWorkoutScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; mes?: string }>();
  const month = typeof params.mes === 'string' && /^\d{4}-\d{2}-01$/.test(params.mes) ? params.mes : currentMonth();

  const workouts = useQuery({ queryKey: queryKeys.history(month), queryFn: () => fetchHistoryWorkouts(month) });
  const workout = workouts.data?.find((item) => item.id === params.id) ?? null;

  return (
    <FormScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title="Corrigir treino" subtitle="O que foi o treino, não quando" fallbackHref="/anais" />

      {workouts.isPending ? (
        <ActivityIndicator color={colors.gold} style={styles.loading} />
      ) : workouts.isError ? (
        <View style={styles.group}>
          <Notice tone="danger" message={errorMessage(workouts.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void workouts.refetch()} />
        </View>
      ) : !workout ? (
        <Notice message="Este treino não está mais neste mês. Volte aos Anais e escolha de novo." />
      ) : (
        // A chave zera o rascunho se o treino trocar: cada correção começa do que está gravado.
        <EditForm key={workout.id} workout={workout} month={month} />
      )}
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: {
    flexShrink: 1,
    gap: space.xs,
  },
  group: {
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
  loading: {
    marginTop: space.xl,
  },
});
