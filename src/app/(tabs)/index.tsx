import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { RankMedallion } from '@/components/rank/rank-medallion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { fetchWeeklyRanking } from '@/features/arena/arena-api';
import { useProfile } from '@/features/auth/session';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { takePendingInvite } from '@/features/legions/pending-invite';
import { rankFromGlory } from '@/features/ranks/tiers';
import { intensityLabel, workoutTypeLabel } from '@/features/workouts/workout-types';
import { fetchMyProgress } from '@/features/workouts/workouts-api';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { formatRemaining, toRoman, weekInfo } from '@/lib/week';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfile();

  const progress = useQuery({ queryKey: queryKeys.progress, queryFn: fetchMyProgress });
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const legion = legions.data?.[0] ?? null;
  const ranking = useQuery({
    queryKey: queryKeys.ranking(legion?.id ?? '', 0),
    queryFn: () => fetchWeeklyRanking(legion?.id as string, 0),
    enabled: legion !== null,
  });

  useEffect(() => {
    // Link de convite aberto antes do login: segue para a entrada na Legião.
    const code = takePendingInvite();
    if (code) router.push({ pathname: '/legioes/entrar', params: { codigo: code } });
  }, [router]);

  if (!profile) return null;

  const week = weekInfo(new Date());
  const rank = progress.data ? rankFromGlory(progress.data.totalGlory) : null;
  const me = ranking.data?.entries.find((entry) => entry.isMe) ?? null;
  const leader = ranking.data?.entries[0] ?? null;
  const last = progress.data?.lastWorkout ?? null;
  const lastLabel = last ? `${workoutTypeLabel(last.type)} · ${last.durationMin} min · ${intensityLabel(last.intensity)}` : null;

  const refreshing = progress.isRefetching || legions.isRefetching || ranking.isRefetching;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void progress.refetch();
            void legions.refetch();
            if (legion) void ranking.refetch();
          }}
          tintColor={colors.gold}
        />
      }>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="overline" tone="muted">
            {`Semana ${toRoman(week.number)} · termina em ${formatRemaining(week.remainingMs)}`}
          </AppText>
          <AppText variant="title" numberOfLines={1}>{`Ave, ${profile.displayName}`}</AppText>
        </View>
        <EmblemAvatar emblem={profile.emblem} size={46} />
      </View>

      {progress.isError ? (
        <View style={styles.actions}>
          <Notice tone="danger" message={errorMessage(progress.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void progress.refetch()} />
        </View>
      ) : !rank || !progress.data ? (
        <ActivityIndicator color={colors.gold} style={styles.loading} />
      ) : (
        <>
          <View style={styles.rank}>
            <RankMedallion tier={rank.tierId} size={148} accessibilityLabel={`Seu rank: ${rank.label}`} />
            <AppText variant="heading">{rank.label}</AppText>
            <AppText tone="secondary" style={styles.tabular}>{`${rank.glory} de Glória`}</AppText>
          </View>

          <View style={styles.progress}>
            <ProgressBar
              value={rank.progress}
              accessibilityLabel={rank.next ? `Progresso até ${rank.next.label}` : 'Rank máximo alcançado'}
            />
            <View style={styles.progressLabels}>
              <AppText variant="caption" tone="muted" style={styles.tabular}>{`${rank.label} · ${rank.currentMin}`}</AppText>
              <AppText variant="caption" tone="secondary" style={styles.tabular}>
                {rank.next ? `Faltam ${rank.next.remaining} para ${rank.next.label}` : 'Você chegou ao Olimpo'}
              </AppText>
            </View>
          </View>

          <View style={styles.stats}>
            <Card style={styles.stat}>
              <AppText variant="caption" tone="muted">Glória da semana</AppText>
              <AppText variant="stat" tone="goldHighlight">{String(progress.data.weekGlory)}</AppText>
              <AppText variant="caption" tone="secondary">
                {`${progress.data.weekScoredWorkouts} ${progress.data.weekScoredWorkouts === 1 ? 'treino' : 'treinos'}`}
              </AppText>
            </Card>
            <Pressable
              style={styles.statPressable}
              accessibilityRole="button"
              accessibilityLabel={legion ? `Arena da ${legion.name}` : 'Arena: funde ou entre em uma Legião'}
              onPress={() => router.navigate(legion ? { pathname: '/arena', params: { legiao: legion.id } } : '/legiao')}>
              <Card style={styles.stat}>
                {legion ? (
                  <>
                    <AppText variant="caption" tone="muted" numberOfLines={1}>{`Arena · ${legion.name}`}</AppText>
                    <AppText variant="stat">{me ? `${me.place}º` : '—'}</AppText>
                    {me && leader && !leader.isMe && leader.weekGlory > me.weekGlory ? (
                      <AppText variant="caption" tone="secondary" style={styles.tabular} numberOfLines={1}>
                        {`${leader.weekGlory - me.weekGlory} atrás de ${leader.displayName}`}
                      </AppText>
                    ) : me ? (
                      <AppText variant="caption" tone="secondary">Na liderança</AppText>
                    ) : null}
                  </>
                ) : legions.isSuccess ? (
                  <>
                    <AppText variant="caption" tone="muted">Arena</AppText>
                    <AppText variant="bodyMedium">Sem Legião ainda</AppText>
                    <AppText variant="caption" tone="gold">Fundar ou entrar</AppText>
                  </>
                ) : (
                  <ActivityIndicator color={colors.gold} />
                )}
              </Card>
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.actions}>
        <Button label="Registrar treino" icon="registrar" onPress={() => router.push('/registrar')} />
        {last && lastLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Repetir último treino: ${lastLabel}`}
            onPress={() => router.push('/registrar')}
            style={({ pressed }) => [styles.repeat, { borderColor: colors.hairline }, pressed && { opacity: 0.85 }]}>
            <Icon name="repetir" size={22} color={colors.gold} />
            <View style={styles.repeatText}>
              <AppText variant="bodyMedium">Repetir último</AppText>
              <AppText variant="label" tone="muted">{lastLabel}</AppText>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl * 3,
    gap: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: {
    flexShrink: 1,
    gap: space.xs,
  },
  loading: {
    marginVertical: space.xxxl * 2,
  },
  rank: {
    alignItems: 'center',
    gap: space.xs,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  progress: {
    gap: space.sm,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: space.md,
  },
  stat: {
    flex: 1,
    gap: space.xs,
  },
  statPressable: {
    flex: 1,
  },
  actions: {
    gap: space.md,
  },
  repeat: {
    minHeight: touchTarget + 16,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  repeatText: {
    flex: 1,
    gap: 2,
  },
});
