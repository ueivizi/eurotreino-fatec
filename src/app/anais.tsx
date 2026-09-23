import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal } from '@/components/motion/reveal';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import {
  fetchHistoryMonths,
  fetchHistoryWorkouts,
  type HistoryWorkout,
} from '@/features/workouts/history-api';
import { formatDistance, formatLoad, performanceFor } from '@/features/workouts/metrics';
import { WORKOUT_TYPES, intensityLabel, workoutTypeLabel, type WorkoutTypeId } from '@/features/workouts/workout-types';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "2026-09-01" → "setembro de 2026". O mês vem como data pura: nada de fuso no caminho. */
function monthLabel(month: string): string {
  const [year, index] = month.split('-');
  return `${MONTHS[Number(index) - 1] ?? month} de ${year}`;
}

/** Primeiro dia do mês corrente, no relógio do aparelho. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function dayOf(date: Date): string {
  return String(date.getDate()).padStart(2, '0');
}

function timeOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Uma linha de treino: o que foi, quando, e o que rendeu. */
function WorkoutRow({ workout, month, index }: { workout: HistoryWorkout; month: string; index: number }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const type = WORKOUT_TYPES.find((item) => item.id === workout.type);

  const details = [
    workout.distanceM === null ? null : formatDistance(workout.distanceM),
    workout.distanceM === null ? null : performanceFor(workout.type, workout.distanceM, workout.durationMin),
    workout.setsCount === null ? null : `${workout.setsCount} ${workout.setsCount === 1 ? 'série' : 'séries'}`,
    workout.loadKg === null ? null : formatLoad(workout.loadKg),
    workout.avgHeartRate === null ? null : `${workout.avgHeartRate} bpm`,
  ].filter(Boolean);

  const composition = [
    { label: 'Presença', value: workout.presence },
    { label: `Duração · ${workout.durationMin} min`, value: workout.duration },
    { label: `Intensidade · ${intensityLabel(workout.intensity).toLowerCase()}`, value: workout.intensityPoints },
    ...(workout.bonus > 0 ? [{ label: 'Constância · 3º treino da semana', value: workout.bonus }] : []),
  ];

  return (
    <Reveal index={Math.min(index, 8)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${workout.note ?? workoutTypeLabel(workout.type)}, dia ${dayOf(workout.performedAt)} às ${timeOf(
          workout.performedAt,
        )}, ${workout.points} de Glória`}
        onPress={() => setOpen((value) => !value)}
        style={[styles.row, { borderColor: colors.hairlineSoft, backgroundColor: colors.surface }]}>
        <View style={[styles.day, { borderColor: colors.hairline }]}>
          <AppText variant="bodyMedium" tone="goldHighlight">{dayOf(workout.performedAt)}</AppText>
          <AppText variant="caption" tone="muted">{timeOf(workout.performedAt)}</AppText>
        </View>

        <View style={styles.flex}>
          <View style={styles.rowHead}>
            <Icon name={type?.icon ?? 'outro'} size={18} color={colors.gold} />
            <AppText variant="bodyMedium" numberOfLines={1} style={styles.flex}>
              {workout.note ?? workoutTypeLabel(workout.type)}
            </AppText>
          </View>
          <AppText variant="caption" tone="muted" numberOfLines={open ? undefined : 1}>
            {[`${workout.durationMin} min`, intensityLabel(workout.intensity), ...details].join(' · ')}
          </AppText>
        </View>

        <View style={styles.points}>
          <AppText variant="bodyMedium" tone={workout.isScored ? 'goldHighlight' : 'muted'}>
            {workout.isScored ? `+${workout.points}` : '—'}
          </AppText>
        </View>
      </Pressable>

      {open ? (
        <Card style={styles.detail}>
          <AppText variant="overline" tone="muted">De onde veio a Glória</AppText>
          {workout.isScored ? (
            composition.map((part) => (
              <View key={part.label} style={styles.part}>
                <AppText variant="label" tone="secondary" style={styles.flex}>{part.label}</AppText>
                <AppText variant="label" tone="goldHighlight">{`+${part.value}`}</AppText>
              </View>
            ))
          ) : (
            <AppText variant="label" tone="secondary">
              Este treino entrou no histórico sem Glória: passou do limite de dois treinos pontuados no dia.
            </AppText>
          )}
          {workout.note ? (
            <AppText variant="caption" tone="muted">{`Anotado como "${workout.note}".`}</AppText>
          ) : null}
          <Button
            label="Compartilhar como imagem"
            icon="compartilhar"
            variant="ghost"
            onPress={() => router.navigate({ pathname: '/compartilhar/[id]', params: { id: workout.id, mes: month } })}
          />
          {/* Corrigir só vale na semana corrente: o Coliseu das passadas já foi disputado (RF014). */}
          {workout.canEdit ? (
            <Button
              label="Corrigir treino"
              icon="editar"
              variant="ghost"
              onPress={() => router.navigate({ pathname: '/corrigir/[id]', params: { id: workout.id, mes: month } })}
            />
          ) : null}
        </Card>
      ) : null}
    </Reveal>
  );
}

/** Anais (RF012): o histórico de treinos, mês a mês. */
export default function HistoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<WorkoutTypeId | null>(null);

  const months = useQuery({ queryKey: queryKeys.historyMonths, queryFn: fetchHistoryMonths });
  const workouts = useQuery({ queryKey: queryKeys.history(month), queryFn: () => fetchHistoryWorkouts(month) });

  const summary = months.data?.find((item) => item.month === month) ?? null;
  const known = useMemo(() => months.data?.map((item) => item.month) ?? [], [months.data]);
  const position = known.indexOf(month);
  const older = position >= 0 && position + 1 < known.length ? known[position + 1] : null;
  const newer = position > 0 ? known[position - 1] : null;

  const shown = filter ? (workouts.data ?? []).filter((workout) => workout.type === filter) : workouts.data ?? [];
  // Só as modalidades que aparecem no mês viram filtro: chip que não filtra nada é ruído.
  const types = [...new Set((workouts.data ?? []).map((workout) => workout.type))];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}
      refreshControl={
        <RefreshControl
          refreshing={workouts.isRefetching || months.isRefetching}
          onRefresh={() => {
            void months.refetch();
            void workouts.refetch();
          }}
          tintColor={colors.gold}
        />
      }>
      <ScreenHeader title="Anais" subtitle="Tudo o que você já registrou" />

      <View style={styles.monthRow}>
        <Button
          label="Anterior"
          icon="chevronLeft"
          variant="ghost"
          disabled={!older}
          onPress={() => older && setMonth(older)}
        />
        <View style={styles.monthText}>
          <AppText variant="subheading" numberOfLines={1}>{monthLabel(month)}</AppText>
          <AppText variant="caption" tone="muted">
            {summary
              ? `${summary.workoutsCount} ${summary.workoutsCount === 1 ? 'treino' : 'treinos'} · ${summary.glory} de Glória`
              : 'Nenhum treino neste mês'}
          </AppText>
        </View>
        <Button
          label="Seguinte"
          icon="chevronRight"
          variant="ghost"
          disabled={!newer}
          onPress={() => newer && setMonth(newer)}
        />
      </View>

      {types.length > 1 ? (
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Filtrar por modalidade">
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: filter === null }}
            accessibilityLabel="Tudo"
            onPress={() => setFilter(null)}
            style={[
              styles.chip,
              { borderColor: filter === null ? colors.gold : colors.hairlineSoft, backgroundColor: filter === null ? colors.selectedFill : 'transparent' },
            ]}>
            <AppText variant="label" tone={filter === null ? 'primary' : 'secondary'}>Tudo</AppText>
          </Pressable>
          {types.map((type) => {
            const selected = filter === type;
            return (
              <Pressable
                key={type}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={workoutTypeLabel(type)}
                onPress={() => setFilter(selected ? null : type)}
                style={[
                  styles.chip,
                  { borderColor: selected ? colors.gold : colors.hairlineSoft, backgroundColor: selected ? colors.selectedFill : 'transparent' },
                ]}>
                <AppText variant="label" tone={selected ? 'primary' : 'secondary'}>{workoutTypeLabel(type)}</AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {workouts.isPending ? (
        <ActivityIndicator color={colors.gold} style={styles.loading} />
      ) : workouts.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(workouts.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void workouts.refetch()} />
        </View>
      ) : shown.length === 0 ? (
        <Notice
          message={
            (workouts.data ?? []).length === 0
              ? 'Nenhum treino neste mês. O que você registrar aparece aqui, com a Glória de cada um.'
              : 'Nenhum treino desta modalidade neste mês.'
          }
        />
      ) : (
        <View style={styles.list}>
          {shown.map((workout, index) => (
            <WorkoutRow key={workout.id} workout={workout} month={month} index={index} />
          ))}
        </View>
      )}

      <AppText variant="caption" tone="muted">
        Seus treinos ficam só com você: a Legião vê a Glória da semana, nunca o que você fez para
        chegar nela.
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  monthText: {
    flex: 1,
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  list: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touchTarget + 16,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  day: {
    width: 48,
    alignItems: 'center',
    borderRightWidth: 1,
    paddingRight: space.sm,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  points: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  detail: {
    gap: space.xs,
    marginTop: space.xs,
  },
  part: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
  block: {
    gap: space.md,
  },
  loading: {
    marginTop: space.xl,
  },
});
