import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Reveal } from '@/components/motion/reveal';
import { RollingNumber } from '@/components/motion/rolling-number';
import { Skeleton } from '@/components/motion/skeleton';
import { EmblemAvatar, type Laurel } from '@/components/rank/emblem-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { LOUROS, SEASON_WEEKS, missingForMinimum } from '@/features/legions/louros';
import type { LegionSummary } from '@/features/legions/legions-parsers';
import { fetchSeasonTable } from '@/features/legions/season-api';
import type { SeasonEntry } from '@/features/legions/season-parsers';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const SEASONS = [
  { id: 0, label: 'Temporada atual' },
  { id: -1, label: 'Anterior' },
] as const;

const LAURELS: Record<number, Laurel> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function addDays(isoDate: string, days: number): Date {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

/** Subiu ou caiu na última semana fechada: a seta pula, verde para cima e terracota para baixo. */
function DeltaChip({ delta }: { delta: number }) {
  const { colors } = useTheme();
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <Reveal delay={500} style={[styles.delta, { borderColor: up ? colors.success : colors.danger }]}>
      <Icon name={up ? 'subir' : 'descer'} size={11} color={up ? colors.success : colors.danger} strokeWidth={2} />
      <AppText variant="caption" tone={up ? 'success' : 'danger'} style={styles.tabular}>{`${up ? '+' : ''}${delta}`}</AppText>
    </Reveal>
  );
}

function Row({ entry, index, minimum, current, onPress }: { entry: SeasonEntry; index: number; minimum: number; current: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const missing = current ? missingForMinimum(entry.weekScored, minimum) : 0;
  const danger = current && missing > 0;
  return (
    <Animated.View layout={LinearTransition.springify().damping(22).stiffness(150)}>
      <Reveal index={index} delay={120}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${entry.place}º: ${entry.displayName}${entry.isMe ? ' (você)' : ''}, ${entry.louros} Louros${
            current ? `, ${Math.min(entry.weekScored, minimum)} de ${minimum} treinos nesta semana` : ''
          }. Ver perfil.`}
          onPress={onPress}
          style={[
            styles.row,
            {
              borderColor: danger ? colors.danger : colors.hairlineSoft,
              backgroundColor: entry.isMe ? colors.selectedFill : colors.surface,
            },
          ]}>
          <AppText variant="bodyMedium" tone={entry.place <= 3 ? 'goldHighlight' : 'muted'} style={styles.place}>
            {String(entry.place)}
          </AppText>
          <EmblemAvatar emblem={entry.emblem} color={entry.emblemColor} size={38} laurel={entry.louros > 0 ? LAURELS[entry.place] : undefined} />
          <View style={styles.rowText}>
            <AppText variant="bodyMedium" numberOfLines={1}>{entry.isMe ? `${entry.displayName} · você` : entry.displayName}</AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {`${entry.weeksMet}/${entry.weeksCounted} semanas cumpridas · ${entry.podiums} ${entry.podiums === 1 ? 'pódio' : 'pódios'}`}
            </AppText>
            {current ? (
              <View style={styles.pips}>
                {Array.from({ length: minimum }, (_, pip) => (
                  <View
                    key={pip}
                    style={[styles.pip, { backgroundColor: pip < entry.weekScored ? colors.gold : 'transparent', borderColor: pip < entry.weekScored ? colors.gold : colors.hairline }]}
                  />
                ))}
                <AppText variant="caption" tone={danger ? 'danger' : 'success'}>
                  {danger ? `faltam ${missing}` : 'mínimo feito'}
                </AppText>
              </View>
            ) : null}
          </View>
          <View style={styles.score}>
            <RollingNumber value={entry.louros} from={0} delay={200 + index * 40} variant="heading" tone={entry.place <= 3 ? 'goldHighlight' : 'primary'} />
            <DeltaChip delta={entry.lastDelta} />
          </View>
        </PressableScale>
      </Reveal>
    </Animated.View>
  );
}

/**
 * Tabela da temporada competitiva: Louros de cada um, quem subiu ou caiu na última semana e, na
 * temporada corrente, quem ainda deve treinos para não perder Louros.
 */
export function SeasonTableView({ legion }: { legion: LegionSummary }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [offset, setOffset] = useState<0 | -1>(0);
  const table = useQuery({
    queryKey: queryKeys.season(legion.id, offset),
    queryFn: () => fetchSeasonTable(legion.id, offset),
  });

  const data = table.data;
  const current = offset === 0 && (data?.seasonWeek ?? 0) > 0;
  const minimum = data?.weeklyMinimum || legion.weeklyMinimum || 0;

  return (
    <View style={styles.block}>
      <SegmentedControl options={SEASONS} value={offset} onChange={setOffset} accessibilityLabel="Temporada" />

      {table.isPending ? (
        <View style={styles.block}>
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} width="100%" height={64} />
          ))}
        </View>
      ) : table.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(table.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void table.refetch()} />
        </View>
      ) : !data || data.entries.length === 0 ? (
        <Notice message="Ainda não houve temporada anterior nesta Legião." />
      ) : (
        <>
          <Reveal>
            <Card style={styles.header}>
              <View style={styles.headerRow}>
                <View style={styles.inline}>
                  <Icon name="espadas" size={18} color={colors.gold} />
                  <AppText variant="overline" tone="gold">
                    {offset === -1 ? 'Temporada encerrada' : data.seasonWeek === 0 ? 'Primeira temporada' : `Semana ${data.seasonWeek} de ${SEASON_WEEKS}`}
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted">
                  {`${dayFormat.format(addDays(data.seasonStart, 0))} a ${dayFormat.format(addDays(data.seasonStart, SEASON_WEEKS * 7 - 1))}`}
                </AppText>
              </View>
              <View style={styles.weeks}>
                {Array.from({ length: SEASON_WEEKS }, (_, week) => {
                  const done = offset === -1 || week + 1 < data.seasonWeek;
                  const now = offset === 0 && week + 1 === data.seasonWeek;
                  return (
                    <View
                      key={week}
                      style={[
                        styles.week,
                        { backgroundColor: done ? colors.gold : now ? colors.selectedFill : 'transparent', borderColor: done || now ? colors.gold : colors.hairline },
                      ]}
                    />
                  );
                })}
              </View>
              <AppText variant="caption" tone="secondary">
                {data.seasonWeek === 0 && offset === 0
                  ? `Começa segunda, ${dayFormat.format(addDays(data.seasonStart, 0))}. Até lá, ninguém ganha nem perde Louros.`
                  : `Mínimo de ${minimum} treinos pontuados por semana. Só semanas fechadas mexem nos Louros.`}
              </AppText>
            </Card>
          </Reveal>

          <View style={styles.list}>
            {data.entries.map((entry, index) => (
              <Row
                key={entry.userId}
                entry={entry}
                index={index}
                minimum={minimum}
                current={current}
                onPress={() =>
                  entry.isMe
                    ? router.navigate('/perfil')
                    : router.push({ pathname: '/membro/[id]', params: { id: entry.userId, legiao: legion.id } })
                }
              />
            ))}
          </View>

          <Card style={styles.rules}>
            <AppText variant="overline" tone="muted">Como a temporada conta</AppText>
            {[
              `Cumpriu o mínimo da semana: +${LOUROS.met} Louros.`,
              `Ficou abaixo do mínimo: ${LOUROS.missed}. Os Louros nunca ficam negativos.`,
              `Pódio da semana: +${LOUROS.podium[0]}, +${LOUROS.podium[1]} e +${LOUROS.podium[2]}.`,
              'No fim das 4 semanas, o pódio ganha Triunfos, e quem cumpriu o mínimo em todas ganha o Invicto.',
              'A Glória e o rank de ninguém caem: os Louros são só desta Legião.',
            ].map((rule) => (
              <View key={rule} style={styles.rule}>
                <View style={[styles.bullet, { backgroundColor: colors.gold }]} />
                <AppText variant="caption" tone="secondary" style={styles.flex}>{rule}</AppText>
              </View>
            ))}
          </Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space.md,
  },
  header: {
    gap: space.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  weeks: {
    flexDirection: 'row',
    gap: space.xs,
  },
  week: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
  },
  list: {
    gap: space.sm,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  place: {
    minWidth: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  pips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  pip: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1,
  },
  score: {
    alignItems: 'flex-end',
    gap: 2,
  },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  rules: {
    gap: space.xs,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  flex: {
    flex: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
