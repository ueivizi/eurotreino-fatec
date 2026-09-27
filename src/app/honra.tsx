import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal } from '@/components/motion/reveal';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { modalityRows } from '@/features/training/honor-records';
import { fetchMyHonor, type HonorEntry } from '@/features/training/strength-api';
import { formatDistance, formatLoad, formatPace, formatSpeed, paceModality } from '@/features/workouts/metrics';
import { fetchMyRecords, type ModalityRecord } from '@/features/workouts/records-api';
import { WORKOUT_TYPES, isWorkoutTypeId, workoutTypeLabel } from '@/features/workouts/workout-types';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

function modalityLabel(type: string): string {
  return isWorkoutTypeId(type) ? workoutTypeLabel(type) : type;
}

function modalityIcon(type: string): IconName {
  return WORKOUT_TYPES.find((item) => item.id === type)?.icon ?? 'outro';
}

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Número com rótulo pequeno em cima e valor em ouro embaixo. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" tone="muted">{label}</AppText>
      <AppText variant="bodyMedium" tone="goldHighlight" style={styles.tabular}>{value}</AppText>
    </View>
  );
}

/** Barra do nível de Honra: mostra o caminho dentro do nível atual, não o total desde o começo. */
function HonorProgress({ entry }: { entry: HonorEntry }) {
  const next = entry.nextLevelPoints;
  const floor = next === null ? entry.points : Math.max(0, entry.points - (next - entry.points));
  const progress = next === null ? 1 : Math.min(1, Math.max(0, (entry.points - floor) / Math.max(1, next - floor)));
  return (
    <>
      <ProgressBar value={progress} accessibilityLabel={next === null ? 'Nível máximo de Honra' : `Progresso até ${next} de Honra`} />
      <AppText variant="caption" tone="muted" style={styles.tabular}>
        {next === null ? 'Nível máximo alcançado' : `Faltam ${next - entry.points} para o próximo nível`}
      </AppText>
    </>
  );
}

/** Os números da modalidade: distância e ritmo na resistência, carga e séries na força. */
function RecordStats({ record }: { record: ModalityRecord }) {
  const speed = record.bestPaceSecondsPerKm === null ? null : 3600 / record.bestPaceSecondsPerKm;
  const stats = [
    record.bestDistanceM === null ? null : { label: 'Maior distância', value: formatDistance(record.bestDistanceM) },
    record.bestDistanceM === null ? null : { label: 'Distância somada', value: formatDistance(record.totalDistanceM) },
    record.module === 'resistencia' && record.bestPaceSecondsPerKm !== null
      ? paceModality(record.type) === 'velocidade' && speed !== null
        ? { label: 'Melhor velocidade', value: formatSpeed(speed) }
        : { label: 'Melhor ritmo', value: formatPace(record.bestPaceSecondsPerKm) }
      : null,
    record.module === 'forca' && record.bestLoadKg !== null ? { label: 'Maior carga', value: formatLoad(record.bestLoadKg) } : null,
    record.module === 'forca' && record.bestSetsCount !== null ? { label: 'Mais séries', value: String(record.bestSetsCount) } : null,
  ].filter((stat): stat is { label: string; value: string } => stat !== null);

  if (stats.length === 0) return null;
  return (
    <View style={styles.stats}>
      {stats.map((stat) => (
        <Stat key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </View>
  );
}

function ModalityCard({ type, honor, record, index }: { type: string; honor: HonorEntry | null; record: ModalityRecord | null; index: number }) {
  const { colors } = useTheme();
  const summary = [
    honor ? `${honor.levelName} · ${honor.points} de Honra` : null,
    record ? `${record.workoutsCount} ${record.workoutsCount === 1 ? 'treino' : 'treinos'} · ${formatHours(record.totalMinutes)}` : null,
  ].filter(Boolean);

  return (
    <Reveal index={index}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Icon name={modalityIcon(type)} size={24} color={colors.gold} />
          <View style={styles.headerText}>
            <AppText variant="subheading" numberOfLines={2}>{modalityLabel(type)}</AppText>
            <AppText variant="caption" tone="secondary">{summary.join(' · ')}</AppText>
          </View>
        </View>
        {honor ? <HonorProgress entry={honor} /> : null}
        {record ? <RecordStats record={record} /> : null}
      </Card>
    </Reveal>
  );
}

function ExerciseCard({ entry, index }: { entry: HonorEntry; index: number }) {
  const { colors } = useTheme();
  const best = [
    entry.bestLoadKg ? `Maior carga: ${formatLoad(entry.bestLoadKg)}` : null,
    entry.bestReps ? `Mais repetições: ${entry.bestReps}` : null,
    entry.bestE1rm ? `Estimativa para 1 repetição: ${formatLoad(entry.bestE1rm)}` : null,
  ].filter(Boolean);

  return (
    <Reveal index={index}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Icon name="musculacao" size={24} color={colors.gold} />
          <View style={styles.headerText}>
            <AppText variant="subheading" numberOfLines={2}>{entry.exerciseName ?? entry.exerciseId}</AppText>
            <AppText variant="caption" tone="secondary">{`${entry.levelName} · ${entry.points} de Honra`}</AppText>
          </View>
        </View>
        <HonorProgress entry={entry} />
        {best.length > 0 ? <AppText variant="label" tone="secondary">{best.join(' · ')}</AppText> : null}
      </Card>
    </Reveal>
  );
}

/**
 * Honra e recordes (quadro 6.5): o domínio em cada modalidade e exercício, com os números de cada um.
 * Fica fora do Coliseu de propósito — lá a disputa é de Glória, com a mesma regra para todo mundo.
 */
export default function HonorScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const honor = useQuery({ queryKey: queryKeys.honor, queryFn: fetchMyHonor });
  const records = useQuery({ queryKey: queryKeys.records, queryFn: fetchMyRecords });

  const modalities = modalityRows(honor.data ?? [], records.data ?? []);
  const exercises = (honor.data ?? []).filter((entry) => entry.exerciseId !== null);
  const failed = honor.isError ? honor.error : records.isError ? records.error : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}
      refreshControl={
        <RefreshControl
          refreshing={honor.isRefetching || records.isRefetching}
          onRefresh={() => {
            void honor.refetch();
            void records.refetch();
          }}
          tintColor={colors.gold}
        />
      }>
      <ScreenHeader title="Honra e recordes" subtitle="Seu domínio e seus números em cada modalidade" />

      {honor.isPending || records.isPending ? (
        <ActivityIndicator color={colors.gold} />
      ) : failed ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(failed)} />
          <Button
            label="Tentar de novo"
            variant="secondary"
            onPress={() => {
              void honor.refetch();
              void records.refetch();
            }}
          />
        </View>
      ) : modalities.length === 0 && exercises.length === 0 ? (
        <Notice message="A Honra aparece quando você treina: +3 no primeiro treino do dia em cada exercício ou modalidade, e +7 ao bater seu próprio recorde." />
      ) : (
        <>
          {modalities.length > 0 ? (
            <>
              <AppText variant="overline" tone="muted">Modalidades</AppText>
              {modalities.map((row, index) => (
                <ModalityCard key={`tipo-${row.type}`} type={row.type} honor={row.honor} record={row.record} index={index} />
              ))}
            </>
          ) : null}

          {exercises.length > 0 ? (
            <>
              <AppText variant="overline" tone="muted">Exercícios</AppText>
              {exercises.map((entry, index) => (
                <ExerciseCard key={`ex-${entry.exerciseId}`} entry={entry} index={index} />
              ))}
            </>
          ) : null}
        </>
      )}

      <AppText variant="caption" tone="muted">
        Honra, distância, ritmo e carga são só seus: não entram no Coliseu nem aparecem para a Legião. A disputa
        semanal continua sendo de Glória.
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
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
    marginTop: space.xs,
  },
  stat: {
    gap: 2,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
