import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Reveal } from '@/components/motion/reveal';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { RollingNumber } from '@/components/motion/rolling-number';
import { Skeleton } from '@/components/motion/skeleton';
import { EmblemAvatar, type Laurel } from '@/components/rank/emblem-avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { fetchWeeklyRanking } from '@/features/arena/arena-api';
import type { RankingEntry } from '@/features/arena/arena-parsers';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { rankFromGlory } from '@/features/ranks/tiers';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { formatRemaining, toRoman, weekInfo } from '@/lib/week';
import { spring } from '@/theme/motion';
import { useTheme } from '@/theme/theme';
import { fonts, radius, space, touchTarget } from '@/theme/tokens';

const LAURELS: Record<number, { laurel: Laurel; color: string; numeral: string }> = {
  1: { laurel: 'gold', color: '#E6C878', numeral: 'I' },
  2: { laurel: 'silver', color: '#C3C7CB', numeral: 'II' },
  3: { laurel: 'bronze', color: '#C98A55', numeral: 'III' },
};

/**
 * Ordem visual do pódio: 2º à esquerda, 1º no centro, 3º à direita.
 * `rise` é a ordem de subida dos pedestais: 3º, depois 2º e, por último, o 1º.
 */
const PODIUM_SLOTS: { index: number; pedestal: number; rise: number }[] = [
  { index: 1, pedestal: 64, rise: 1 },
  { index: 0, pedestal: 92, rise: 2 },
  { index: 2, pedestal: 48, rise: 0 },
];

const RISE_STEP = 140;

const WEEKS = [
  { id: 0, label: 'Esta semana' },
  { id: -1, label: 'Semana passada' },
] as const;

const weekStartFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function describe(entry: RankingEntry) {
  return `${entry.place}º lugar: ${entry.displayName}${entry.isMe ? ' (você)' : ''}, ${rankFromGlory(entry.totalGlory).label}, ${entry.weekGlory} de Glória na semana`;
}

/** "Pedestal": sobe de baixo para cima, recortado pela própria base. */
function Pedestal({ height, color, numeral, delay }: { height: number; color: string; numeral: string; delay: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const offset = useSharedValue(reduced ? 0 : height);

  useEffect(() => {
    if (reduced) {
      offset.set(0);
      return;
    }
    offset.set(withDelay(delay, withSpring(0, spring.settle)));
    return () => cancelAnimation(offset);
  }, [reduced, delay, offset]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  return (
    <View style={[styles.pedestalClip, { height }]}>
      <Animated.View style={[styles.pedestal, { height, borderTopColor: color, backgroundColor: colors.surface }, style]}>
        <AppText variant="heading" style={{ color, fontFamily: fonts.displayBold }}>
          {numeral}
        </AppText>
      </Animated.View>
    </View>
  );
}

function ArenaSkeleton() {
  return (
    <View style={styles.block} accessibilityLabel="Carregando a Arena" accessibilityRole="progressbar">
      <View style={styles.podium}>
        {PODIUM_SLOTS.map((slot) => (
          <View key={slot.index} style={[styles.podiumColumn, { gap: space.sm }]}>
            <Skeleton width={slot.index === 0 ? 64 : 54} height={slot.index === 0 ? 64 : 54} radius={32} />
            <Skeleton width="70%" height={12} />
            <Skeleton width="100%" height={slot.pedestal} radius={0} />
          </View>
        ))}
      </View>
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} width="100%" height={44} />
      ))}
    </View>
  );
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
  // Trocar de Legião ou de semana remonta o pódio: a cerimônia de subida acompanha o novo ranking.
  const podiumKey = `${legion?.id ?? ''}:${weekOffset}`;

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
        <ArenaSkeleton />
      ) : legions.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(legions.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void legions.refetch()} />
        </View>
      ) : !legion ? (
        <Reveal style={styles.block}>
          <Notice message="A Arena é a disputa semanal dentro de uma Legião. Funde a sua ou entre com um código para começar." />
          <Button label="Ir para Legião" onPress={() => router.navigate('/legiao')} />
        </Reveal>
      ) : (
        <>
          {list.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {list.map((item) => {
                const selected = item.id === legion.id;
                return (
                  <PressableScale
                    key={item.id}
                    haptic="select"
                    accessibilityRole="button"
                    accessibilityLabel={`Arena da ${item.name}`}
                    accessibilityState={{ selected }}
                    onPress={() => router.setParams({ legiao: item.id })}
                    style={[
                      styles.chip,
                      { borderColor: selected ? colors.gold : colors.hairlineSoft, backgroundColor: selected ? colors.selectedFill : 'transparent' },
                    ]}>
                    <AppText variant="label" tone={selected ? 'goldHighlight' : 'secondary'} numberOfLines={1}>{item.name}</AppText>
                  </PressableScale>
                );
              })}
            </ScrollView>
          ) : null}

          <SegmentedControl options={WEEKS} value={weekOffset} onChange={setWeekOffset} accessibilityLabel="Semana" />

          <AppText variant="label" tone="muted">
            {weekOffset === 0
              ? `${legion.name} · ${legion.memberCount} ${legion.memberCount === 1 ? 'membro' : 'membros'} · Semana ${toRoman(week.number)}`
              : `${legion.name} · semana de ${ranking.data?.weekStart ? weekStartFormat.format(new Date(`${ranking.data.weekStart}T00:00:00Z`)) : '…'}`}
          </AppText>

          {ranking.isPending ? (
            <ArenaSkeleton />
          ) : ranking.isError ? (
            <View style={styles.block}>
              <Notice tone="danger" message={errorMessage(ranking.error)} />
              <Button label="Tentar de novo" variant="secondary" onPress={() => void ranking.refetch()} />
            </View>
          ) : (
            <>
              <View key={podiumKey} style={styles.podium} accessibilityRole="list" accessibilityLabel="Pódio da semana">
                {PODIUM_SLOTS.map((slot) => {
                  const entry = podium[slot.index];
                  if (!entry) return <View key={slot.index} style={styles.podiumColumn} />;
                  const style = LAURELS[entry.place] ?? LAURELS[3];
                  const hasGlory = entry.weekGlory > 0;
                  const riseDelay = slot.rise * RISE_STEP;
                  return (
                    <View key={entry.userId} style={styles.podiumColumn} accessible accessibilityLabel={describe(entry)}>
                      <Reveal delay={riseDelay + 180} style={styles.podiumPerson}>
                        <EmblemAvatar
                          emblem={entry.emblem}
                          size={slot.index === 0 ? 88 : 76}
                          laurel={hasGlory ? style.laurel : undefined}
                          crownDelay={riseDelay + 320}
                        />
                        <AppText variant="bodyMedium" numberOfLines={1}>{entry.isMe ? `${entry.displayName} · você` : entry.displayName}</AppText>
                        <AppText variant="caption" tone="muted" numberOfLines={1}>{rankFromGlory(entry.totalGlory).label}</AppText>
                      </Reveal>
                      <RollingNumber
                        value={entry.weekGlory}
                        from={0}
                        delay={riseDelay + 260}
                        variant="heading"
                        style={{ color: style.color, fontFamily: fonts.bodySemibold }}
                      />
                      <Pedestal height={slot.pedestal} color={style.color} numeral={LAURELS[entry.place]?.numeral ?? String(entry.place)} delay={riseDelay} />
                    </View>
                  );
                })}
              </View>

              <View>
                {rest.map((entry, index) => (
                  <Animated.View key={entry.userId} layout={LinearTransition.springify().damping(22).stiffness(150)}>
                    <Reveal index={index} delay={520}>
                      <View
                        style={[
                          styles.row,
                          { borderBottomColor: colors.hairlineSoft },
                          entry.isMe ? { backgroundColor: colors.selectedFill } : null,
                        ]}
                        accessible
                        accessibilityLabel={describe(entry)}>
                        <AppText variant="bodyMedium" tone="muted" style={styles.position}>{String(entry.place)}</AppText>
                        <EmblemAvatar emblem={entry.emblem} size={36} />
                        <View style={styles.rowText}>
                          <AppText variant="bodyMedium" numberOfLines={1}>{entry.isMe ? `${entry.displayName} · você` : entry.displayName}</AppText>
                          <AppText variant="caption" tone="muted">{rankFromGlory(entry.totalGlory).label}</AppText>
                        </View>
                        <RollingNumber value={entry.weekGlory} variant="bodyMedium" tone="secondary" containerStyle={styles.glory} />
                      </View>
                    </Reveal>
                  </Animated.View>
                ))}
              </View>

              {entries.length === 1 ? (
                <Reveal delay={400}>
                  <Notice message="Por enquanto só você está nesta Arena. Compartilhe o código da Legião para a disputa começar." />
                </Reveal>
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
  podiumPerson: {
    alignItems: 'center',
    gap: 2,
    alignSelf: 'stretch',
  },
  pedestalClip: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    marginTop: space.xs,
  },
  pedestal: {
    borderTopWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1,
    paddingHorizontal: space.xs,
  },
  position: {
    minWidth: 24,
    fontVariant: ['tabular-nums'],
  },
  rowText: {
    flex: 1,
  },
  glory: {
    minWidth: 24,
    justifyContent: 'flex-end',
  },
  privacy: {
    justifyContent: 'center',
    marginTop: space.sm,
  },
});
