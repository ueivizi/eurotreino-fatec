import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Halo } from '@/components/motion/halo';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Reveal } from '@/components/motion/reveal';
import { RollingNumber } from '@/components/motion/rolling-number';
import { Shimmer } from '@/components/motion/shimmer';
import { Skeleton } from '@/components/motion/skeleton';
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

const MEDALLION = 148;
/** O disco da moeda ocupa 124 de 168 unidades do desenho do medalhão. */
const COIN = Math.round((MEDALLION * 124) / 168);
const HALO = 300;

/** Forma do Início enquanto os dados chegam: a pessoa já vê onde cada coisa vai ficar. */
function HomeSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityLabel="Carregando seu progresso" accessibilityRole="progressbar">
      <View style={styles.rank}>
        <Skeleton width={COIN} height={COIN} radius={COIN / 2} style={{ margin: (MEDALLION - COIN) / 2 }} />
        <Skeleton width={150} height={24} />
        <Skeleton width={96} height={16} />
      </View>
      <Skeleton width="100%" height={6} radius={3} />
      <View style={styles.stats}>
        <Skeleton width="48%" height={104} />
        <Skeleton width="48%" height={104} />
      </View>
    </View>
  );
}

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
      <Reveal style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="overline" tone="muted">
            {`Semana ${toRoman(week.number)} · termina em ${formatRemaining(week.remainingMs)}`}
          </AppText>
          <AppText variant="title" numberOfLines={1}>{`Ave, ${profile.displayName}`}</AppText>
        </View>
        <EmblemAvatar emblem={profile.emblem} size={46} />
      </Reveal>

      {progress.isError ? (
        <View style={styles.actions}>
          <Notice tone="danger" message={errorMessage(progress.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void progress.refetch()} />
        </View>
      ) : !rank || !progress.data ? (
        <HomeSkeleton />
      ) : (
        <>
          <View style={styles.rank}>
            <View style={styles.medallion}>
              <Halo size={HALO} strength={0.22} style={{ top: (MEDALLION - HALO) / 2, left: (MEDALLION - HALO) / 2 }} />
              <Reveal>
                <RankMedallion tier={rank.tierId} size={MEDALLION} accessibilityLabel={`Seu rank: ${rank.label}`} />
              </Reveal>
              {/* O brilho passa só sobre o disco da moeda, a cada ~7 s. */}
              <View style={[styles.coin, { width: COIN, height: COIN, borderRadius: COIN / 2 }]}>
                <Shimmer radius={COIN / 2} delay={1600} interval={7000} />
              </View>
            </View>
            <Reveal index={1}>
              <AppText variant="heading" style={styles.center}>{rank.label}</AppText>
            </Reveal>
            <RollingNumber
              value={rank.glory}
              suffix=" de Glória"
              tone="secondary"
              accessibilityLabel={`${rank.glory} de Glória`}
            />
          </View>

          <Reveal index={2} style={styles.progress}>
            <ProgressBar
              value={rank.progress}
              delay={180}
              accessibilityLabel={rank.next ? `Progresso até ${rank.next.label}` : 'Rank máximo alcançado'}
            />
            <View style={styles.progressLabels}>
              <AppText variant="caption" tone="muted" style={styles.tabular}>{`${rank.label} · ${rank.currentMin}`}</AppText>
              <AppText variant="caption" tone="secondary" style={styles.tabular}>
                {rank.next ? `Faltam ${rank.next.remaining} para ${rank.next.label}` : 'Você chegou ao Olimpo'}
              </AppText>
            </View>
          </Reveal>

          <View style={styles.stats}>
            <Reveal index={3} style={styles.statColumn}>
              <Card style={styles.stat}>
                <AppText variant="caption" tone="muted">Glória da semana</AppText>
                <RollingNumber value={progress.data.weekGlory} variant="stat" tone="goldHighlight" />
                <AppText variant="caption" tone="secondary">
                  {`${progress.data.weekScoredWorkouts} ${progress.data.weekScoredWorkouts === 1 ? 'treino' : 'treinos'}`}
                </AppText>
              </Card>
            </Reveal>
            <Reveal index={4} style={styles.statColumn}>
              <PressableScale
                style={styles.statColumn}
                accessibilityRole="button"
                accessibilityLabel={legion ? `Arena da ${legion.name}` : 'Arena: funde ou entre em uma Legião'}
                onPress={() => router.navigate(legion ? { pathname: '/arena', params: { legiao: legion.id } } : '/legiao')}>
                <Card style={styles.stat}>
                  {legion ? (
                    <>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>{`Arena · ${legion.name}`}</AppText>
                      {me ? (
                        <RollingNumber value={me.place} suffix="º" variant="stat" accessibilityLabel={`${me.place}º lugar`} />
                      ) : (
                        <AppText variant="stat">—</AppText>
                      )}
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
                    <>
                      <Skeleton width="60%" height={12} />
                      <Skeleton width={56} height={32} />
                      <Skeleton width="80%" height={12} />
                    </>
                  )}
                </Card>
              </PressableScale>
            </Reveal>
          </View>
        </>
      )}

      <Reveal index={5} style={styles.actions}>
        <Button label="Registrar treino" icon="registrar" onPress={() => router.push('/registrar')} />
        {last && lastLabel ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Repetir último treino: ${lastLabel}`}
            onPress={() => router.push('/registrar')}
            style={[styles.repeat, { borderColor: colors.hairline }]}>
            <Icon name="repetir" size={22} color={colors.gold} />
            <View style={styles.repeatText}>
              <AppText variant="bodyMedium">Repetir último</AppText>
              <AppText variant="label" tone="muted">{lastLabel}</AppText>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textMuted} />
          </PressableScale>
        ) : null}
      </Reveal>
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
  skeleton: {
    gap: space.xl,
  },
  rank: {
    alignItems: 'center',
    gap: space.xs,
  },
  medallion: {
    width: MEDALLION,
    height: MEDALLION,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coin: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  center: {
    textAlign: 'center',
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
    justifyContent: 'space-between',
    gap: space.md,
  },
  statColumn: {
    flex: 1,
  },
  stat: {
    flex: 1,
    gap: space.xs,
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
