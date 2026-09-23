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
import { TabFade } from '@/components/motion/tab-fade';
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
import { WEEK_RESTART_MOTTO } from '@/features/celebrations/mottos';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { takePendingInvite } from '@/features/legions/pending-invite';
import { takeFirstSteps } from '@/features/onboarding/first-steps';
import { SCORING } from '@/features/ranks/scoring';
import { rankFromGlory } from '@/features/ranks/tiers';
import { formatDistance, formatLoad } from '@/features/workouts/metrics';
import { useOfflineQueue } from '@/features/workouts/offline-queue-provider';
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

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

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
  const queue = useOfflineQueue();

  const progress = useQuery({ queryKey: queryKeys.progress, queryFn: fetchMyProgress });
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const legion = legions.data?.[0] ?? null;
  const ranking = useQuery({
    queryKey: queryKeys.ranking(legion?.id ?? '', 0),
    queryFn: () => fetchWeeklyRanking(legion?.id as string, 0),
    enabled: legion !== null,
  });

  useEffect(() => {
    // Logo depois de criar o perfil, os primeiros passos continuam de onde pararam. Eles também
    // consomem o convite pendente no fim do caminho, por isso vêm antes.
    if (takeFirstSteps()) {
      router.push({ pathname: '/gloria', params: { primeiro: '1' } });
      return;
    }
    // Link de convite aberto antes do login: segue para a entrada na Legião.
    const code = takePendingInvite();
    if (code) router.push({ pathname: '/legioes/entrar', params: { codigo: code } });
  }, [router]);

  if (!profile) return null;

  const week = weekInfo(new Date());
  // A Arena zera toda segunda: quem já treinou antes vê a semana recomeçando, não um monte de zeros.
  const weekRestarted =
    progress.data !== undefined &&
    progress.data.totalWorkouts > 0 &&
    progress.data.weekGlory === 0 &&
    progress.data.weekScoredWorkouts === 0;
  const startedToday = WEEK_MS - week.remainingMs < DAY_MS;
  const constancy = (progress.data?.weekScoredWorkouts ?? 0) >= SCORING.weeklyBonusAt;
  const rank = progress.data ? rankFromGlory(progress.data.totalGlory) : null;
  const me = ranking.data?.entries.find((entry) => entry.isMe) ?? null;
  const leader = ranking.data?.entries[0] ?? null;
  const last = progress.data?.lastWorkout ?? null;
  // O rótulo mostra o que vai ser repetido, detalhes da modalidade incluídos.
  const lastLabel = last
    ? [
        last.note ?? workoutTypeLabel(last.type),
        `${last.durationMin} min · ${intensityLabel(last.intensity)}`,
        last.distanceM === null ? null : formatDistance(last.distanceM),
        last.setsCount === null ? null : `${last.setsCount} séries`,
        last.loadKg === null ? null : `${formatLoad(last.loadKg)} kg`,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const refreshing = progress.isRefetching || legions.isRefetching || ranking.isRefetching;

  return (
    <TabFade>
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
            {`Semana ${toRoman(week.number)} · ${
              weekRestarted && startedToday ? 'começou hoje' : `termina em ${formatRemaining(week.remainingMs)}`
            }`}
          </AppText>
          <AppText variant="title" numberOfLines={1}>{`Ave, ${profile.displayName}`}</AppText>
        </View>
        <EmblemAvatar emblem={profile.emblem} color={profile.emblemColor} size={46} />
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
              <AppText variant="caption" tone="muted" style={styles.tabular}>
                {weekRestarted ? 'Sua Glória continua sua' : `${rank.label} · ${rank.currentMin}`}
              </AppText>
              <AppText variant="caption" tone="secondary" style={styles.tabular}>
                {rank.next ? `Faltam ${rank.next.remaining} para ${rank.next.label}` : 'Você chegou ao Olimpo'}
              </AppText>
            </View>
          </Reveal>

          {weekRestarted ? (
            <Reveal index={3}>
              <Card style={styles.restart}>
                <View style={styles.motto}>
                  <AppText variant="motto" tone="goldHighlight">{WEEK_RESTART_MOTTO.latin}</AppText>
                  <AppText variant="caption" tone="muted">{WEEK_RESTART_MOTTO.translation}</AppText>
                </View>
                <AppText variant="body" tone="secondary">
                  {legion
                    ? `A Arena recomeçou e todo mundo está no zero. Um treino já coloca você na disputa da ${legion.name}.`
                    : 'A Arena recomeçou e todo mundo está no zero. Um treino já coloca você na disputa.'}
                </AppText>
              </Card>
            </Reveal>
          ) : (
            <View style={styles.stats}>
              <Reveal index={3} style={styles.statColumn}>
                <Card style={styles.stat}>
                  <AppText variant="caption" tone="muted">Glória da semana</AppText>
                  <RollingNumber value={progress.data.weekGlory} variant="stat" tone="goldHighlight" />
                  {/* Garantida a partir do 3º treino pontuado: o bônus da semana já está no bolso. */}
                  <AppText variant="caption" tone={constancy ? 'success' : 'secondary'}>
                    {constancy
                      ? 'Constância garantida'
                      : `${progress.data.weekScoredWorkouts} ${progress.data.weekScoredWorkouts === 1 ? 'treino' : 'treinos'}`}
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
          )}
        </>
      )}

      {queue.pending.length > 0 || queue.failures.length > 0 ? (
        <Reveal index={5} style={styles.actions}>
          {queue.pending.length > 0 ? (
            <Notice
              message={`${queue.pending.length} ${
                queue.pending.length === 1 ? 'treino guardado neste aparelho ainda não foi enviado' : 'treinos guardados neste aparelho ainda não foram enviados'
              }. A Glória entra quando ${queue.pending.length === 1 ? 'ele chegar' : 'eles chegarem'} ao servidor.`}
            />
          ) : null}
          {queue.failures.length > 0 ? (
            <Notice tone="danger" message={queue.failures[0]?.message ?? 'Um treino guardado não pôde ser enviado.'} />
          ) : null}
          <View style={styles.queueActions}>
            {queue.pending.length > 0 ? (
              <Button
                label={queue.flushing ? 'Enviando…' : 'Enviar agora'}
                icon="nuvem"
                variant="secondary"
                onPress={() => void queue.flush()}
                disabled={queue.flushing}
              />
            ) : null}
            {queue.failures.length > 0 ? (
              <Button label="Entendi" variant="ghost" onPress={queue.dismissFailures} />
            ) : null}
          </View>
        </Reveal>
      ) : null}

      <Reveal index={6} style={styles.actions}>
        <Button label="Registrar treino" icon="registrar" onPress={() => router.push('/registrar')} />
        <Button label="Treinar agora" icon="ampulheta" variant="secondary" onPress={() => router.push('/sessao')} />
        {last && lastLabel ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Repetir último treino: ${lastLabel}`}
            onPress={() => router.push({ pathname: '/registrar', params: { repetir: '1' } })}
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
    </TabFade>
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
  restart: {
    gap: space.sm,
  },
  motto: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  stat: {
    flex: 1,
    gap: space.xs,
  },
  actions: {
    gap: space.md,
  },
  queueActions: {
    gap: space.xs,
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
