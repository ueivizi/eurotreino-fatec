import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal } from '@/components/motion/reveal';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { formatDistance, formatLoad, formatPace, formatSpeed, paceModality } from '@/features/workouts/metrics';
import { fetchMyRecords, type ModalityRecord } from '@/features/workouts/records-api';
import { WORKOUT_TYPES, workoutTypeLabel } from '@/features/workouts/workout-types';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Linha de número: rótulo pequeno em cima, valor em ouro embaixo. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" tone="muted">{label}</AppText>
      <AppText variant="bodyMedium" tone="goldHighlight" style={styles.tabular}>{value}</AppText>
    </View>
  );
}

function ModalityCard({ record, index }: { record: ModalityRecord; index: number }) {
  const { colors } = useTheme();
  const icon = WORKOUT_TYPES.find((type) => type.id === record.type)?.icon ?? 'outro';
  const speed = record.bestPaceSecondsPerKm === null ? null : 3600 / record.bestPaceSecondsPerKm;

  return (
    <Reveal index={index}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name={icon} size={26} color={colors.gold} />
          <View style={styles.cardTitle}>
            <AppText variant="subheading">{workoutTypeLabel(record.type)}</AppText>
            <AppText variant="caption" tone="secondary">
              {`${record.workoutsCount} ${record.workoutsCount === 1 ? 'treino' : 'treinos'} · ${formatHours(record.totalMinutes)}`}
            </AppText>
          </View>
        </View>

        {record.bestDistanceM !== null ? (
          <View style={styles.stats}>
            <Stat label="Maior distância" value={formatDistance(record.bestDistanceM)} />
            <Stat label="Distância somada" value={formatDistance(record.totalDistanceM)} />
            {record.module === 'resistencia' && record.bestPaceSecondsPerKm !== null ? (
              <Stat
                label={paceModality(record.type) === 'velocidade' ? 'Melhor velocidade' : 'Melhor ritmo'}
                value={
                  paceModality(record.type) === 'velocidade' && speed !== null
                    ? formatSpeed(speed)
                    : formatPace(record.bestPaceSecondsPerKm)
                }
              />
            ) : null}
          </View>
        ) : null}

        {record.module === 'forca' && (record.bestLoadKg !== null || record.bestSetsCount !== null) ? (
          <View style={styles.stats}>
            {record.bestLoadKg !== null ? <Stat label="Maior carga" value={formatLoad(record.bestLoadKg)} /> : null}
            {record.bestSetsCount !== null ? <Stat label="Mais séries" value={String(record.bestSetsCount)} /> : null}
          </View>
        ) : null}
      </Card>
    </Reveal>
  );
}

/**
 * Recordes pessoais por modalidade. Números só seus: recorde não entra na Arena nem aparece para a
 * Legião, porque a disputa semanal é de Glória, e ela não muda com distância nem com carga.
 */
export default function RecordsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const records = useQuery({ queryKey: queryKeys.records, queryFn: fetchMyRecords });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}
      refreshControl={
        <RefreshControl refreshing={records.isRefetching} onRefresh={() => void records.refetch()} tintColor={colors.gold} />
      }>
      <ScreenHeader title="Recordes" subtitle="Seus números em cada modalidade" />

      {records.isPending ? (
        <ActivityIndicator color={colors.gold} />
      ) : records.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(records.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void records.refetch()} />
        </View>
      ) : records.data.length === 0 ? (
        <Notice message="Registre treinos para ver seus números aqui. Distância, séries e carga são opcionais no registro." />
      ) : (
        records.data.map((record, index) => <ModalityCard key={record.type} record={record} index={index} />)
      )}

      <AppText variant="caption" tone="muted">
        Distância, ritmo e carga ficam só com você: a Arena disputa Glória, que não muda com esses números.
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
    gap: space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  cardTitle: {
    flex: 1,
    gap: 2,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
  },
  stat: {
    gap: 2,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
