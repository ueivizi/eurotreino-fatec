import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal } from '@/components/motion/reveal';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { fetchMyHonor, type HonorEntry } from '@/features/training/strength-api';
import { formatLoad } from '@/features/workouts/metrics';
import { WORKOUT_TYPES, isWorkoutTypeId, workoutTypeLabel } from '@/features/workouts/workout-types';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

function titleOf(entry: HonorEntry): string {
  if (entry.exerciseId) return entry.exerciseName ?? entry.exerciseId;
  if (entry.workoutType && isWorkoutTypeId(entry.workoutType)) return workoutTypeLabel(entry.workoutType);
  return entry.workoutType ?? '—';
}

function iconOf(entry: HonorEntry) {
  if (entry.exerciseId) return 'musculacao' as const;
  const found = WORKOUT_TYPES.find((type) => type.id === entry.workoutType);
  return found?.icon ?? ('outro' as const);
}

function HonorCard({ entry, index }: { entry: HonorEntry; index: number }) {
  const { colors } = useTheme();
  const next = entry.nextLevelPoints;
  // A barra mostra o caminho dentro do nível atual, não o total desde o começo.
  const floor = next === null ? entry.points : Math.max(0, entry.points - (next - entry.points));
  const progress = next === null ? 1 : Math.min(1, Math.max(0, (entry.points - floor) / Math.max(1, next - floor)));

  return (
    <Reveal index={index}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Icon name={iconOf(entry)} size={24} color={colors.gold} />
          <View style={styles.headerText}>
            <AppText variant="subheading" numberOfLines={2}>{titleOf(entry)}</AppText>
            <AppText variant="caption" tone="secondary">
              {`${entry.levelName} · ${entry.points} de Honra`}
            </AppText>
          </View>
        </View>

        <ProgressBar
          value={progress}
          accessibilityLabel={next === null ? 'Nível máximo de Honra' : `Progresso até ${next} de Honra`}
        />
        <AppText variant="caption" tone="muted" style={styles.tabular}>
          {next === null ? 'Nível máximo alcançado' : `Faltam ${next - entry.points} para o próximo nível`}
        </AppText>

        {entry.bestE1rm || entry.bestLoadKg ? (
          <AppText variant="label" tone="secondary">
            {[
              entry.bestLoadKg ? `Maior carga: ${formatLoad(entry.bestLoadKg)}` : null,
              entry.bestReps ? `Mais repetições: ${entry.bestReps}` : null,
              entry.bestE1rm ? `Estimativa para 1 repetição: ${formatLoad(entry.bestE1rm)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        ) : null}
      </Card>
    </Reveal>
  );
}

/**
 * Honra: progressão pessoal por exercício e por modalidade. Fica fora da Arena de propósito — lá a
 * disputa é de Glória, com a mesma regra para todo mundo.
 */
export default function HonorScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const honor = useQuery({ queryKey: queryKeys.honor, queryFn: fetchMyHonor });

  const exercises = (honor.data ?? []).filter((entry) => entry.exerciseId !== null);
  const modalities = (honor.data ?? []).filter((entry) => entry.workoutType !== null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}
      refreshControl={<RefreshControl refreshing={honor.isRefetching} onRefresh={() => void honor.refetch()} tintColor={colors.gold} />}>
      <ScreenHeader title="Honra" subtitle="Seu domínio em cada exercício e modalidade" />

      {honor.isPending ? (
        <ActivityIndicator color={colors.gold} />
      ) : honor.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(honor.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void honor.refetch()} />
        </View>
      ) : honor.data.length === 0 ? (
        <Notice message="A Honra aparece quando você treina: +3 no primeiro treino do dia em cada exercício ou modalidade, e +7 ao bater seu próprio recorde." />
      ) : (
        <>
          {modalities.length > 0 ? (
            <>
              <AppText variant="overline" tone="muted">Modalidades</AppText>
              {modalities.map((entry, index) => (
                <HonorCard key={`tipo-${entry.workoutType}`} entry={entry} index={index} />
              ))}
            </>
          ) : null}

          {exercises.length > 0 ? (
            <>
              <AppText variant="overline" tone="muted">Exercícios</AppText>
              {exercises.map((entry, index) => (
                <HonorCard key={`ex-${entry.exerciseId}`} entry={entry} index={index} />
              ))}
            </>
          ) : null}
        </>
      )}

      <AppText variant="caption" tone="muted">
        A Honra é só sua: não entra na Arena nem aparece para a Legião. A disputa semanal continua sendo de Glória.
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  block: {
    gap: space.md,
  },
  card: {
    gap: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
