import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemAvatar, type Laurel } from '@/components/rank/emblem-avatar';
import { Button, tapFeedback } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { fetchWeeklyRanking } from '@/features/arena/arena-api';
import type { RankingEntry } from '@/features/arena/arena-parsers';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { rankFromGlory } from '@/features/ranks/tiers';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { formatRemaining, toRoman, weekInfo } from '@/lib/week';
import { useTheme } from '@/theme/theme';
import { fonts, radius, space, touchTarget } from '@/theme/tokens';

const LAURELS: Record<number, { laurel: Laurel; color: string; numeral: string }> = {
  1: { laurel: 'gold', color: '#E6C878', numeral: 'I' },
  2: { laurel: 'silver', color: '#C3C7CB', numeral: 'II' },
  3: { laurel: 'bronze', color: '#C98A55', numeral: 'III' },
};

/** Ordem visual do pódio: 2º à esquerda, 1º no centro, 3º à direita. */
const PODIUM_SLOTS: { index: number; pedestal: number }[] = [
  { index: 1, pedestal: 64 },
  { index: 0, pedestal: 92 },
  { index: 2, pedestal: 48 },
];

const weekStartFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function describe(entry: RankingEntry) {
  return `${entry.place}º lugar: ${entry.displayName}${entry.isMe ? ' (você)' : ''}, ${rankFromGlory(entry.totalGlory).label}, ${entry.weekGlory} de Glória na semana`;
}

export default function ArenaScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ legiao?: string }>();
  const [weekOffset, setWeekOffset] = useState<0 | -1>(0);

  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const list = legions.data ?? [];
  const legion = list.find((item) => item.id === params.legiao) ?? list[0] ?? null;

  const ranking = useQuery({
    queryKey: queryKeys.ranking(legion?.id ?? '', weekOffset),
    queryFn: () => fetchWeeklyRanking(legion?.id as string, weekOffset),
    enabled: legion !== null,
  });

  const week = weekInfo(new Date());
  const entries = ranking.data?.entries ?? [];
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={legions.isRefetching || ranking.isRefetching}
          onRefresh={() => {
            void legions.refetch();
            if (legion) void ranking.refetch();
          }}
          tintColor={colors.gold}
        />
      }>
      <View style={styles.header}>
        <AppText variant="title">Arena</AppText>
        {weekOffset === 0 ? (
          <View style={styles.inline}>
            <Icon name="ampulheta" size={16} color={colors.gold} />
            <AppText variant="label" tone="secondary">{`termina em ${formatRemaining(week.remainingMs)}`}</AppText>
          </View>
        ) : null}
      </View>

      {legions.isPending ? (
        <ActivityIndicator color={colors.gold} style={styles.loading} />
      ) : legions.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(legions.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void legions.refetch()} />
        </View>
      ) : !legion ? (
        <View style={styles.block}>
          <Notice message="A Arena é a disputa semanal dentro de uma Legião. Funde a sua ou entre com um código para começar." />
          <Button label="Ir para Legião" onPress={() => router.navigate('/legiao')} />
        </View>
      ) : (
        <>
          {list.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {list.map((item) => {
                const selected = item.id === legion.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Arena da ${item.name}`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      tapFeedback();
                      router.setParams({ legiao: item.id });
                    }}
                    style={[
                      styles.chip,
                      { borderColor: selected ? colors.gold : colors.hairlineSoft, backgroundColor: selected ? colors.selectedFill : 'transparent' },
                    ]}>
                    <AppText variant="label" tone={selected ? 'goldHighlight' : 'secondary'} numberOfLines={1}>{item.name}</AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={[styles.segmented, { borderColor: colors.hairline }]} accessibilityRole="radiogroup" accessibilityLabel="Semana">
            {([0, -1] as const).map((offset) => {
              const selected = offset === weekOffset;
              return (
                <Pressable
                  key={offset}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    tapFeedback();
                    setWeekOffset(offset);
                  }}
                  style={[styles.segment, selected && { backgroundColor: colors.selectedFill, borderColor: colors.gold, borderWidth: 1 }]}>
                  <AppText variant={selected ? 'button' : 'body'} tone={selected ? 'goldHighlight' : 'secondary'}>
                    {offset === 0 ? 'Esta semana' : 'Semana passada'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <AppText variant="label" tone="muted">
            {weekOffset === 0
              ? `${legion.name} · ${legion.memberCount} ${legion.memberCount === 1 ? 'membro' : 'membros'} · Semana ${toRoman(week.number)}`
              : `${legion.name} · semana de ${ranking.data?.weekStart ? weekStartFormat.format(new Date(`${ranking.data.weekStart}T00:00:00Z`)) : '…'}`}
          </AppText>

          {ranking.isPending ? (
            <ActivityIndicator color={colors.gold} style={styles.loading} />
          ) : ranking.isError ? (
            <View style={styles.block}>
              <Notice tone="danger" message={errorMessage(ranking.error)} />
              <Button label="Tentar de novo" variant="secondary" onPress={() => void ranking.refetch()} />
            </View>
          ) : (
            <>
              <View style={styles.podium} accessibilityRole="list" accessibilityLabel="Pódio da semana">
                {PODIUM_SLOTS.map((slot) => {
                  const entry = podium[slot.index];
                  if (!entry) return <View key={slot.index} style={styles.podiumColumn} />;
                  const style = LAURELS[entry.place] ?? LAURELS[3];
                  const hasGlory = entry.weekGlory > 0;
                  return (
                    <View key={entry.userId} style={styles.podiumColumn} accessible accessibilityLabel={describe(entry)}>
                      <EmblemAvatar emblem={entry.emblem} size={slot.index === 0 ? 88 : 76} laurel={hasGlory ? style.laurel : undefined} />
                      <AppText variant="bodyMedium" numberOfLines={1}>{entry.isMe ? `${entry.displayName} · você` : entry.displayName}</AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>{rankFromGlory(entry.totalGlory).label}</AppText>
                      <AppText variant="heading" style={{ color: style.color, fontFamily: fonts.bodySemibold }}>
                        {String(entry.weekGlory)}
                      </AppText>
                      <View style={[styles.pedestal, { height: slot.pedestal, borderTopColor: style.color, backgroundColor: colors.surface }]}>
                        <AppText variant="heading" style={{ color: style.color, fontFamily: fonts.displayBold }}>
                          {LAURELS[entry.place]?.numeral ?? String(entry.place)}
                        </AppText>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View>
                {rest.map((entry) => (
                  <View
                    key={entry.userId}
                    style={[styles.row, { borderBottomColor: colors.hairlineSoft }]}
                    accessible
                    accessibilityLabel={describe(entry)}>
                    <AppText variant="bodyMedium" tone="muted" style={styles.position}>{String(entry.place)}</AppText>
                    <EmblemAvatar emblem={entry.emblem} size={36} />
                    <View style={styles.rowText}>
                      <AppText variant="bodyMedium" numberOfLines={1}>{entry.isMe ? `${entry.displayName} · você` : entry.displayName}</AppText>
                      <AppText variant="caption" tone="muted">{rankFromGlory(entry.totalGlory).label}</AppText>
                    </View>
                    <AppText variant="bodyMedium" tone="secondary" style={styles.position}>{String(entry.weekGlory)}</AppText>
                  </View>
                ))}
              </View>

              {entries.length === 1 ? (
                <Notice message="Por enquanto só você está nesta Arena. Compartilhe o código da Legião para a disputa começar." />
              ) : null}
            </>
          )}

          <View style={[styles.inline, styles.privacy]}>
            <Icon name="escudo" size={14} color={colors.gold} />
            <AppText variant="caption" tone="muted">{`Só membros da ${legion.name} veem esta Arena.`}</AppText>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl * 3,
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  loading: {
    marginVertical: space.xxxl,
  },
  block: {
    gap: space.md,
    marginTop: space.md,
  },
  chips: {
    gap: space.sm,
  },
  chip: {
    minHeight: touchTarget - 8,
    maxWidth: 220,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
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
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    marginTop: space.md,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pedestal: {
    alignSelf: 'stretch',
    borderTopWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1,
  },
  position: {
    minWidth: 24,
    fontVariant: ['tabular-nums'],
  },
  rowText: {
    flex: 1,
  },
  privacy: {
    justifyContent: 'center',
    marginTop: space.sm,
  },
});
