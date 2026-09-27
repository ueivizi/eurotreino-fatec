import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { RollingNumber } from '@/components/motion/rolling-number';
import { ScreenHeader } from '@/components/screen-header';
import { Button, tapFeedback } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { NumberField } from '@/components/ui/number-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { FormScrollView } from '@/components/ui/form-scroll';
import { useProfile } from '@/features/auth/session';
import { healthConnect } from '@/features/devices/health-connect';
import { matchingWorkout } from '@/features/devices/imported-workout';
import { clearTrack, currentTrack } from '@/features/map/gps-store';
import { GPS_AVAILABLE, GpsTracker } from '@/features/map/gps-tracker';
import { LIVE_MAP_AVAILABLE, LiveMap } from '@/features/map/live-map';
import { simplifyRoute } from '@/features/map/route';
import { loadRoutes, storeRoutes, withRoute, type SavedRoute } from '@/features/map/saved-routes';
import { requestExercise, takePickedExercise } from '@/features/training/exercise-picker';
import { fetchExerciseCatalog } from '@/features/training/exercises-api';
import { fetchMyRoutines } from '@/features/training/routines-api';
import {
  MAX_SESSION_HOURS,
  canAddSet,
  durationMinutes,
  elapsedMs,
  finishSession,
  focusForItem,
  formatElapsed,
  isTooLong,
  lapDurations,
  setsOf,
  type PlanItem,
} from '@/features/training/session';
import { useTrainingSession } from '@/features/training/session-provider';
import { logStrengthWorkout, type StrengthOutcome } from '@/features/training/strength-api';
import { formatDistance, formatLoad, performanceFor } from '@/features/workouts/metrics';
import { logWorkout } from '@/features/workouts/workouts-api';
import {
  DISTANCE,
  INTENSITIES,
  LOAD,
  WORKOUT_TYPES,
  workoutModule,
  workoutTypeLabel,
  type IntensityId,
  type WorkoutTypeId,
} from '@/features/workouts/workout-types';
import { queryKeys } from '@/lib/query-client';
import { toRoman } from '@/lib/week';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { duration as motionDuration, easing } from '@/theme/motion';
import { radius, space, touchTarget } from '@/theme/tokens';

const REPS = { min: 1, max: 100, step: 1 } as const;

/** Modalidades que valem a pena acompanhar ao vivo: as duas de força e as três de resistência. */
const SESSION_TYPES = WORKOUT_TYPES.filter((type) =>
  ['musculacao', 'funcional', 'corrida', 'bike', 'natacao'].includes(type.id),
);

/**
 * Exercício concluído: a ficha previa N séries e elas saíram. Um selo de ouro cobre o cartão por
 * um instante antes de passar para o próximo -- é a cerimônia miúda que o treino de força não
 * tinha, e é ela que diz "pode virar a página" sem exigir um toque.
 */
function ExerciseDone({ name, sets }: { name: string; sets: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const scale = useSharedValue(reduced ? 1 : 0.86);
  const opacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    opacity.set(withTiming(1, { duration: motionDuration.fast, easing: easing.standard }));
    scale.set(withTiming(1, { duration: motionDuration.base, easing: easing.standard }));
  }, [opacity, scale, reduced]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${name} concluído: ${sets} séries.`}
      style={[styles.doneOverlay, { backgroundColor: colors.surfaceRaised, borderColor: colors.gold }, style]}>
      <Icon name="check" size={34} color={colors.goldHighlight} strokeWidth={2} />
      <AppText variant="subheading" tone="goldHighlight">Exercício concluído</AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={2}>{`${name} · ${toRoman(sets)} séries`}</AppText>
    </Animated.View>
  );
}

/**
 * Sessão de treino ao vivo. O cronômetro conta a partir dos instantes guardados no aparelho, então
 * fechar o app, trancar a tela ou ficar sem bateria não perde o treino. Só ao finalizar é que o
 * registro vai para o servidor — e lá a Glória continua vindo da regra v1 de sempre.
 */
export default function LiveSessionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ ficha?: string; rota?: string; tipo?: string }>();
  const session = useTrainingSession();
  const profile = useProfile();
  const healthConsent = profile?.healthConsentAt !== null && profile?.healthConsentAt !== undefined;

  const routines = useQuery({ queryKey: queryKeys.routines, queryFn: fetchMyRoutines });
  const catalog = useQuery({ queryKey: queryKeys.exercises, queryFn: fetchExerciseCatalog, staleTime: 10 * 60_000 });

  const [now, setNow] = useState(() => new Date());
  // Vindo do mapa com uma rota, o treino é de resistência: começa na modalidade da rota ou na corrida.
  const [type, setType] = useState<WorkoutTypeId>(() => {
    const asked = SESSION_TYPES.find((option) => option.id === params.tipo && workoutModule(option.id) === 'resistencia');
    return asked ? asked.id : params.rota ? 'corrida' : 'musculacao';
  });
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [routeDropped, setRouteDropped] = useState(false);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  /** A distância do fim veio do GPS: a tela avisa para conferir. */
  const [distanceFromGps, setDistanceFromGps] = useState(false);
  const [routeSaved, setRouteSaved] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [avgHeartRate, setAvgHeartRate] = useState<number | null>(null);
  const [intensity, setIntensity] = useState<IntensityId>('moderado');
  const [extra, setExtra] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  /** O cronômetro foi pausado por "Finalizar treino": voltar ao treino retoma. */
  const [pausedToFinish, setPausedToFinish] = useState(false);
  /** Exercício que acabou de fechar o previsto: o selo aparece um instante por cima do cartão. */
  const [doneExercise, setDoneExercise] = useState<{ name: string; sets: number } | null>(null);
  const [outcome, setOutcome] = useState<StrengthOutcome | null>(null);

  const current = session.current;

  // As rotas moram no aparelho; a sessão guarda só qual foi escolhida.
  useEffect(() => {
    let alive = true;
    void loadRoutes()
      .then((routes) => {
        if (alive) setSavedRoutes(routes);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const plannedRouteId = current ? current.routeId : routeDropped ? null : (params.rota ?? null);
  const plannedRoute = plannedRouteId ? (savedRoutes.find((route) => route.id === plannedRouteId) ?? null) : null;

  // O selo de exercício concluído fica um instante; a sessão já passou a vez ao próximo da ficha.
  useEffect(() => {
    if (!doneExercise) return;
    const timer = setTimeout(() => setDoneExercise(null), 1400);
    return () => clearTimeout(timer);
  }, [doneExercise]);

  // Um tique por segundo só enquanto a sessão está correndo.
  useEffect(() => {
    if (!current || current.pausedAt) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [current]);

  // Exercício escolhido no catálogo entra como avulso, fora da ficha.
  useFocusEffect(
    useCallback(() => {
      const picked = takePickedExercise();
      if (picked) setExtra((list) => (list.includes(picked) ? list : [...list, picked]));
    }, []),
  );

  const routine = current?.routineId ? routines.data?.find((item) => item.id === current.routineId) ?? null : null;

  /*
   * A ficha e o exercício da vez moram na sessão, não na tela: o cartão da tela bloqueada lê e muda
   * os mesmos números com o app fechado. Um exercício por vez, na ordem da ficha — a lista inteira na
   * tela fazia perder o lugar entre uma série e outra (achado do teste de 22/09).
   */
  const strength = current !== null && workoutModule(current.workoutType) !== 'resistencia';
  const plannedIds = strength ? routine?.items.map((item) => item.exerciseId) ?? [] : [];
  const keptIds = strength ? current?.plan.map((item) => item.exerciseId) ?? [] : [];
  const exerciseIds = strength ? [...new Set([...plannedIds, ...keptIds, ...extra])] : [];
  const nameOfId = (id: string) =>
    catalog.data?.exercises.find((item) => item.id === id)?.name ?? current?.plan.find((item) => item.exerciseId === id)?.name ?? 'Exercício';
  const plan: PlanItem[] = exerciseIds.map((id) => {
    const planned = routine?.items.find((item) => item.exerciseId === id);
    const kept = current?.plan.find((item) => item.exerciseId === id);
    return {
      exerciseId: id,
      name: nameOfId(id),
      targetSets: planned ? planned.targetSets : (kept?.targetSets ?? null),
      reps: planned?.targetReps ?? kept?.reps ?? 10,
      loadKg: planned ? (planned.targetLoadKg ?? null) : (kept?.loadKg ?? null),
    };
  });
  const planKey = JSON.stringify(plan);
  const focusId = current?.focus && exerciseIds.includes(current.focus.exerciseId) ? current.focus.exerciseId : (exerciseIds[0] ?? null);
  const focusIndex = focusId ? exerciseIds.indexOf(focusId) : 0;
  const focusItem = plan.find((item) => item.exerciseId === focusId) ?? null;

  const applyPlan = session.setPlan;
  useEffect(() => {
    if (!strength) return;
    void applyPlan(JSON.parse(planKey) as PlanItem[]);
  }, [applyPlan, planKey, strength]);

  // Sem foco (começo da sessão) ou com foco fora da ficha: o primeiro exercício assume.
  const applyFocus = session.setFocus;
  const focusMissing = strength && focusItem !== null && current?.focus?.exerciseId !== focusItem.exerciseId;
  useEffect(() => {
    if (!focusMissing || !current || !focusItem) return;
    void applyFocus(focusForItem(current, focusItem));
  }, [applyFocus, focusMissing, current, focusItem]);

  const focusReps = current?.focus && current.focus.exerciseId === focusId ? current.focus.reps : (focusItem?.reps ?? 10);
  const focusLoad = current?.focus && current.focus.exerciseId === focusId ? (current.focus.loadKg ?? 0) : (focusItem?.loadKg ?? 0);

  /** Muda repetições ou carga do exercício da vez: vale para a próxima série, aqui e no cartão. */
  function changeFocus(values: { reps?: number; loadKg?: number }) {
    if (!focusItem) return;
    const nextLoad = values.loadKg ?? focusLoad;
    void session.setFocus({
      exerciseId: focusItem.exerciseId,
      exerciseName: focusItem.name,
      reps: values.reps ?? focusReps,
      loadKg: nextLoad > 0 ? nextLoad : null,
    });
  }

  function goTo(index: number) {
    const item = plan[index];
    if (!item || !current) return;
    void session.setFocus(focusForItem(current, item));
  }

  // GPS só na resistência, com a escolha ligada e no app instalado.
  const gpsEnabled = current !== null && workoutModule(current.workoutType) === 'resistencia' && GPS_AVAILABLE && Boolean(profile?.locationConsentAt);

  async function saveTrackAsRoute() {
    if (!current) return;
    const points = simplifyRoute(currentTrack(current.requestId).points.map(({ lat, lng }) => ({ lat, lng })));
    try {
      const routes = await loadRoutes();
      const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date());
      await storeRoutes(
        withRoute(routes, {
          id: randomUUID(),
          name: `${workoutTypeLabel(current.workoutType)} de ${day}`,
          points,
          distanceM: 0,
          savedAt: new Date().toISOString(),
        }),
      );
      setRouteSaved('saved');
    } catch {
      setRouteSaved('failed');
    }
  }

  const finish = useMutation({
    mutationFn: async (): Promise<StrengthOutcome> => {
      if (!current) throw new Error('sem sessão');
      const finished = finishSession(current, intensity, new Date());
      if (!finished) throw new Error('intensidade inválida');

      if (workoutModule(current.workoutType) === 'resistencia') {
        const logged = await logWorkout({
          requestId: finished.requestId,
          type: current.workoutType,
          durationMin: finished.durationMin,
          intensity: finished.intensity,
          ...(distanceM === null ? {} : { distanceM }),
          ...(healthConsent && avgHeartRate !== null ? { avgHeartRate } : {}),
        });
        return { workout: logged, records: [], honor: [] };
      }

      return logStrengthWorkout({
        requestId: finished.requestId,
        workoutType: finished.workoutType,
        durationMin: finished.durationMin,
        intensity: finished.intensity,
        sets: finished.sets,
        routineId: finished.routineId,
      });
    },
    onSuccess: async (result) => {
      setOutcome(result);
      clearTrack();
      await session.discard();
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.honor });
      void queryClient.invalidateQueries({ queryKey: queryKeys.records });
      void queryClient.invalidateQueries({ queryKey: queryKeys.weeklyGoal });
      void queryClient.invalidateQueries({ queryKey: queryKeys.historyAll });
    },
  });

  // Integração com o relógio: acha no Health Connect o treino que cobre o tempo cronometrado aqui e
  // preenche distância e frequência cardíaca. A pessoa ainda pode ajustar antes de registrar.
  const fromWatch = useMutation({
    mutationFn: async (): Promise<'filled' | 'unavailable' | 'not_connected' | 'no_match'> => {
      if (!current) return 'no_match';
      if ((await healthConnect.status()) !== 'available') return 'unavailable';
      if (!(await healthConnect.granted()).exercise) return 'not_connected';
      const end = new Date();
      const start = new Date(end.getTime() - elapsedMs(current, end));
      const list = await healthConnect.readWorkouts({
        since: new Date(start.getTime() - 3 * 3600_000),
        until: new Date(end.getTime() + 30 * 60_000),
        heartRate: healthConsent,
      });
      const match = matchingWorkout(list, start, end);
      if (!match) return 'no_match';
      if (match.distanceM !== null && match.distanceM >= DISTANCE.min) {
        setDistanceM(Math.min(DISTANCE.max, Math.round(match.distanceM)));
      }
      if (healthConsent && match.avgHeartRate !== null && match.avgHeartRate >= 30 && match.avgHeartRate <= 240) {
        setAvgHeartRate(Math.round(match.avgHeartRate));
      }
      return 'filled';
    },
  });

  async function begin(routineId: string | null) {
    const routineName = routineId ? routines.data?.find((item) => item.id === routineId)?.name ?? null : null;
    const routeId = workoutModule(type) === 'resistencia' ? (plannedRoute?.id ?? null) : null;
    await session.start({ workoutType: type, requestId: randomUUID(), routineId, routineName, routeId });
    setNow(new Date());
  }

  function nameOf(exerciseId: string): string {
    return catalog.data?.exercises.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
  }

  // Resultado: a sessão acabou e virou treino.
  if (outcome) {
    return (
      <FormScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={styles.hero}>
          <AppText variant="display" tone="goldHighlight">{`+${outcome.workout.points}`}</AppText>
          <AppText variant="heading">Glória</AppText>
          <AppText tone="secondary" style={styles.center}>Treino registrado. As séries entraram no seu histórico.</AppText>
        </View>

        {outcome.workout.isDistanceRecord ? (
          <Card style={styles.block}>
            <AppText variant="overline" tone="gold">Recorde pessoal</AppText>
            <AppText>Sua maior distância nesta modalidade.</AppText>
          </Card>
        ) : null}

        {outcome.records.length > 0 ? (
          <Card style={styles.block}>
            <AppText variant="overline" tone="gold">Recorde pessoal</AppText>
            {outcome.records.map((record) => (
              <AppText key={record.exerciseId}>
                {`${nameOf(record.exerciseId)}: ${record.current.toFixed(1)} kg estimados para 1 repetição (antes ${record.previous.toFixed(1)}).`}
              </AppText>
            ))}
          </Card>
        ) : null}

        {outcome.honor.length > 0 ? (
          <Card style={styles.block}>
            <AppText variant="overline" tone="gold">Honra</AppText>
            {outcome.honor.map((gain) => (
              <AppText key={gain.exerciseId} tone="secondary">
                {`${nameOf(gain.exerciseId)}: +${gain.gained} (total ${gain.points})`}
              </AppText>
            ))}
            <AppText variant="caption" tone="muted">
              Honra é sua progressão pessoal. O Coliseu continua disputando Glória.
            </AppText>
          </Card>
        ) : null}

        <Button label="Ver minha Honra" variant="secondary" onPress={() => router.replace('/honra')} />
        <Button label="Fechar" onPress={() => router.replace('/')} />
      </FormScrollView>
    );
  }

  // Sem sessão: escolher por onde começar.
  if (!current) {
    return (
      <FormScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <ScreenHeader title="Treinar agora" subtitle="Acompanhe o treino enquanto ele acontece" />
        {session.loading ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <>
            <AppText variant="label" tone="secondary">Modalidade</AppText>
            <View style={styles.chips}>
              {SESSION_TYPES.map((option) => {
                const selected = option.id === type;
                return (
                  <PressableScale
                    key={option.id}
                    haptic="select"
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ checked: selected }}
                    onPress={() => setType(option.id)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.gold : colors.hairlineSoft,
                        backgroundColor: selected ? colors.selectedFill : 'transparent',
                      },
                    ]}>
                    <Icon name={option.icon} size={18} color={selected ? colors.goldHighlight : colors.textSecondary} />
                    <AppText variant="label" tone={selected ? 'goldHighlight' : 'secondary'}>{option.label}</AppText>
                  </PressableScale>
                );
              })}
            </View>

            {workoutModule(type) === 'forca' ? (
              <>
                {routines.isPending ? <ActivityIndicator color={colors.gold} /> : null}
                {(routines.data ?? []).map((item) => (
                  <Button
                    key={item.id}
                    label={`Começar: ${item.name}`}
                    icon="registrar"
                    variant={params.ficha === item.id ? 'primary' : 'secondary'}
                    onPress={() => void begin(item.id)}
                  />
                ))}
                <Button label="Treino livre, sem ficha" variant="ghost" onPress={() => void begin(null)} />
                <Button label="Montar uma ficha" variant="ghost" icon="mais" onPress={() => router.push('/fichas')} />
              </>
            ) : (
              <>
                {plannedRoute ? (
                  <Card style={styles.block}>
                    <AppText variant="overline" tone="gold">Rota para seguir</AppText>
                    <AppText variant="bodyMedium">{`${plannedRoute.name} · ${formatDistance(plannedRoute.distanceM)}`}</AppText>
                    <Button label="Treinar sem a rota" variant="ghost" onPress={() => setRouteDropped(true)} />
                  </Card>
                ) : null}
                <Button label="Começar agora" icon="registrar" onPress={() => void begin(null)} />
                <Notice
                  message={
                    profile?.locationConsentAt
                      ? 'Com a Localização ligada, o GPS mede o percurso e o mapa acompanha você ao vivo. O trajeto fica neste aparelho.'
                      : 'Marque voltas durante o treino e informe a distância no fim. Para medir pelo GPS e ver o mapa ao vivo, ligue a Localização em Suas escolhas.'
                  }
                />
              </>
            )}
            <Notice message="O cronômetro fica no aparelho: pode trancar a tela ou fechar o app que a sessão continua de pé." />
          </>
        )}
      </FormScrollView>
    );
  }

  const elapsed = elapsedMs(current, now);
  const isEndurance = !strength;
  const totalSets = current.sets.length;

  const plannedFor = (exerciseId: string) => routine?.items.find((item) => item.exerciseId === exerciseId) ?? null;
  const completed = (exerciseId: string) => {
    const planned = plannedFor(exerciseId);
    return planned !== null && setsOf(current, exerciseId).length >= planned.targetSets;
  };

  return (
    <FormScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <View style={styles.clock}>
        <AppText variant="overline" tone="muted">
          {routine ? routine.name : workoutTypeLabel(current.workoutType)}
        </AppText>
        <AppText variant="display" tone="goldHighlight" style={styles.tabular} accessibilityLabel={`Tempo de treino: ${formatElapsed(elapsed)}`}>
          {formatElapsed(elapsed)}
        </AppText>
        <View style={styles.clockActions}>
          {current.pausedAt ? (
            <Button label="Retomar" icon="registrar" variant="secondary" onPress={() => void session.resume()} />
          ) : (
            <Button label="Pausar" icon="ampulheta" variant="secondary" onPress={() => void session.pause()} />
          )}
        </View>
        <AppText variant="caption" tone="muted">
          {`${totalSets} ${totalSets === 1 ? 'série feita' : 'séries feitas'}`}
        </AppText>
      </View>

      {isTooLong(current, now) ? (
        <Notice message={`Esta sessão passou de ${MAX_SESSION_HOURS} horas. Se você esqueceu o cronômetro ligado, descarte e registre o treino pelo caminho normal.`} />
      ) : null}

      {isEndurance ? (
        <>
          {gpsEnabled ? <GpsTracker sessionKey={current.requestId} paused={current.pausedAt !== null} /> : null}
          {LIVE_MAP_AVAILABLE && (gpsEnabled || plannedRoute) ? (
            <LiveMap sessionKey={current.requestId} route={plannedRoute?.points ?? null} showPosition={gpsEnabled} />
          ) : null}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Marcar volta"
            haptic="tap"
            onPress={() => void session.addLap()}
            style={[styles.setButton, { backgroundColor: colors.selectedFill, borderColor: colors.gold }]}>
            <Icon name="ampulheta" size={20} color={colors.goldHighlight} />
            <AppText variant="button" tone="goldHighlight">Marcar volta</AppText>
          </PressableScale>

          {current.laps.length > 0 ? (
            <Card style={styles.laps}>
              <View style={styles.exerciseHeader}>
                <AppText variant="overline" tone="muted" style={styles.flex}>{`${current.laps.length} ${current.laps.length === 1 ? 'volta' : 'voltas'}`}</AppText>
                <Button label="Desfazer" variant="ghost" onPress={() => void session.removeLastLap()} />
              </View>
              {lapDurations(current).map((duration, index) => (
                <View key={current.laps[index]} style={[styles.lapRow, { borderBottomColor: colors.hairlineSoft }]}>
                  <AppText variant="label" tone="secondary">{`Volta ${index + 1}`}</AppText>
                  <AppText variant="bodyMedium" style={styles.tabular}>{formatElapsed(duration)}</AppText>
                </View>
              ))}
            </Card>
          ) : (
            <Notice message="Toque em “Marcar volta” ao completar cada trecho: o tempo de cada uma fica aqui." />
          )}
        </>
      ) : null}

      {focusId ? (
        (() => {
          const planned = plannedFor(focusId);
          const done = setsOf(current, focusId);
          const target = planned?.targetSets ?? Math.max(done.length + 1, 1);
          const canMark = canAddSet(current, focusId);

          return (
            <>
              <View style={styles.focusHeader}>
                <AppText variant="overline" tone="muted">
                  {`Exercício ${toRoman(focusIndex + 1)} de ${toRoman(exerciseIds.length)}`}
                </AppText>
                <View style={styles.pills} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {exerciseIds.map((id, index) => (
                    <View
                      key={id}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: completed(id)
                            ? colors.success
                            : index === focusIndex
                              ? colors.goldHighlight
                              : colors.track,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>

              <Card style={styles.exercise}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.flex}>
                    <AppText variant="subheading" numberOfLines={2}>{nameOf(focusId)}</AppText>
                    <AppText variant="caption" tone="muted">
                      {planned
                        ? `Previsto: ${planned.targetSets} × ${planned.targetReps}${planned.targetLoadKg ? ` · ${formatLoad(planned.targetLoadKg)}` : ''}`
                        : 'Fora da ficha'}
                    </AppText>
                  </View>
                  <RollingNumber
                    value={done.length}
                    suffix={planned ? `/${planned.targetSets}` : ''}
                    variant="heading"
                    tone={planned && done.length >= planned.targetSets ? 'goldHighlight' : 'secondary'}
                  />
                </View>

                {/* As séries em numeral romano: o mesmo alfabeto das divisões de rank. */}
                <View style={styles.series} accessibilityLabel={`${done.length} de ${target} séries feitas`}>
                  {Array.from({ length: Math.max(target, done.length) }, (_, index) => {
                    const set = done[index];
                    return (
                      <View
                        key={index}
                        style={[
                          styles.serie,
                          {
                            borderColor: set ? colors.gold : colors.hairlineSoft,
                            backgroundColor: set ? colors.selectedFill : 'transparent',
                          },
                        ]}>
                        <AppText variant="label" tone={set ? 'goldHighlight' : 'muted'}>{toRoman(index + 1)}</AppText>
                      </View>
                    );
                  })}
                </View>

                {done.length > 0 ? (
                  <AppText variant="caption" tone="secondary">
                    {done.map((set) => `${set.reps}${set.loadKg ? `×${formatLoad(set.loadKg)}` : ''}`).join(' · ')}
                  </AppText>
                ) : null}

                {/* Um número por linha, na largura toda: lado a lado, a carga passava da tela (teste de 27/09). */}
                <View style={styles.control}>
                  <AppText variant="caption" tone="muted">Repetições</AppText>
                  <NumberField
                    label="Repetições"
                    value={focusReps}
                    onChange={(next) => changeFocus({ reps: next })}
                    min={REPS.min}
                    max={REPS.max}
                    step={REPS.step}
                    format={(next) => String(next)}
                    fill
                  />
                </View>
                <View style={styles.control}>
                  <AppText variant="caption" tone="muted">Carga</AppText>
                  <NumberField
                    label="Carga"
                    value={focusLoad}
                    onChange={(next) => changeFocus({ loadKg: next })}
                    min={0}
                    max={LOAD.max}
                    step={LOAD.step}
                    format={(next) => (next > 0 ? formatLoad(next) : 'Livre')}
                    decimals
                    fill
                  />
                </View>

                <View style={styles.setActions}>
                  {/* A ficha manda: fechada a meta, não entra série a mais (teste de 27/09), e a vez
                      passa sozinha ao próximo exercício que ainda falta. */}
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={canMark ? `Marcar série de ${nameOf(focusId)}` : `${nameOf(focusId)}: séries completas`}
                    accessibilityState={{ disabled: !canMark }}
                    disabled={!canMark}
                    haptic="tap"
                    onPress={() => {
                      const name = nameOf(focusId);
                      const sets = done.length + 1;
                      void session.markSet().then(({ completed: closed }) => {
                        if (closed) setDoneExercise({ name, sets });
                      });
                    }}
                    style={[
                      styles.setButton,
                      canMark
                        ? { backgroundColor: colors.selectedFill, borderColor: colors.gold }
                        : { backgroundColor: 'transparent', borderColor: colors.hairlineSoft },
                    ]}>
                    <Icon name="check" size={20} color={canMark ? colors.goldHighlight : colors.success} />
                    <AppText variant="button" tone={canMark ? 'goldHighlight' : 'success'}>{canMark ? 'Série feita' : 'Séries completas'}</AppText>
                  </PressableScale>
                  {done.length > 0 ? <Button label="Desfazer última série" variant="ghost" onPress={() => void session.removeLastSet(focusId)} /> : null}
                </View>

                {/* Anterior e Próximo dividem a linha; o que não cabe mais vai para a linha de cima. */}
                <View style={styles.navRow}>
                  <View style={styles.navCell}>
                    <Button label="Anterior" icon="chevronLeft" variant="secondary" disabled={focusIndex <= 0} onPress={() => goTo(focusIndex - 1)} />
                  </View>
                  <View style={styles.navCell}>
                    <Button
                      label="Próximo"
                      icon="chevronRight"
                      variant="secondary"
                      disabled={focusIndex + 1 >= exerciseIds.length}
                      onPress={() => goTo(focusIndex + 1)}
                    />
                  </View>
                </View>

                {/* Último filho do cartão: assim o selo pinta por cima de tudo, em qualquer plataforma. */}
                {doneExercise ? <ExerciseDone name={doneExercise.name} sets={doneExercise.sets} /> : null}
              </Card>

              {exerciseIds.length > 1 ? (
                <Card style={styles.exercise}>
                  <AppText variant="overline" tone="muted">A ficha inteira</AppText>
                  {exerciseIds.map((id, index) => {
                    const item = plannedFor(id);
                    const sets = setsOf(current, id).length;
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="button"
                        accessibilityLabel={`${nameOf(id)}, ${sets} séries feitas`}
                        onPress={() => {
                          tapFeedback();
                          goTo(index);
                        }}
                        style={[styles.lapRow, { borderBottomColor: colors.hairlineSoft }]}>
                        <AppText
                          variant="label"
                          tone={index === focusIndex ? 'goldHighlight' : completed(id) ? 'success' : 'secondary'}
                          numberOfLines={1}
                          style={styles.flex}>
                          {`${toRoman(index + 1)}. ${nameOf(id)}`}
                        </AppText>
                        <AppText variant="label" tone="muted" style={styles.tabular}>
                          {item ? `${sets}/${item.targetSets}` : String(sets)}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </Card>
              ) : null}
            </>
          );
        })()
      ) : null}

      <Button
        label="Adicionar exercício"
        icon="mais"
        variant="secondary"
        onPress={() => {
          requestExercise({ kind: 'session' });
          router.push('/exercicios');
        }}
      />

      {finishing ? (
        <View style={styles.block}>
          <AppText variant="overline" tone="muted">Como foi o treino?</AppText>
          <SegmentedControl options={INTENSITIES} value={intensity} onChange={setIntensity} accessibilityLabel="Intensidade" />

          {isEndurance ? (
            <>
              {Platform.OS === 'android' ? (
                <>
                  <Button
                    label={fromWatch.isPending ? 'Buscando no relógio…' : 'Preencher com o relógio'}
                    icon="relogio"
                    variant="secondary"
                    onPress={() => fromWatch.mutate()}
                    disabled={fromWatch.isPending}
                  />
                  {fromWatch.data === 'filled' ? <Notice message="Distância e frequência cardíaca vieram do relógio. Confira antes de registrar." /> : null}
                  {fromWatch.data === 'unavailable' || fromWatch.data === 'not_connected' ? (
                    <Notice message="Conecte o relógio em Perfil › Relógios e GPX para trazer os dados." />
                  ) : null}
                  {fromWatch.data === 'no_match' ? (
                    <Notice message="O treino ainda não chegou ao Health Connect. Sincronize o relógio no app da marca e tente de novo." />
                  ) : null}
                  {fromWatch.isError ? <Notice tone="danger" message="Não foi possível ler o Health Connect agora." /> : null}
                </>
              ) : null}
              <View style={styles.exerciseHeader}>
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">Distância</AppText>
                  <AppText variant="caption" tone="muted">
                    {distanceM === null
                      ? 'Opcional. Não muda a Glória; entra no histórico e nos recordes.'
                      : performanceFor(current.workoutType, distanceM, durationMinutes(current, now)) ?? 'Não muda a Glória; entra no histórico e nos recordes.'}
                  </AppText>
                </View>
                <View style={styles.stepper}>
                  {/* Zero quer dizer "não informei": o registro só manda distância acima disso. */}
                  <NumberField
                    label="Distância"
                    value={distanceM ?? 0}
                    onChange={(next) => {
                      setDistanceFromGps(false);
                      setDistanceM(next > 0 ? next : null);
                    }}
                    min={0}
                    max={DISTANCE.max}
                    step={DISTANCE.step}
                    format={(next) => (next > 0 ? formatDistance(next) : '—')}
                  />
                </View>
              </View>

              {distanceFromGps ? <Notice message="A distância veio do GPS deste aparelho. Confira antes de registrar." /> : null}
              {gpsEnabled && currentTrack(current.requestId).points.length >= 2 ? (
                routeSaved === 'saved' ? (
                  <Notice message="Percurso guardado nas suas rotas, só neste aparelho." />
                ) : (
                  <Button
                    label="Guardar o percurso como rota"
                    icon="local"
                    variant="ghost"
                    onPress={() => void saveTrackAsRoute()}
                  />
                )
              ) : null}
              {routeSaved === 'failed' ? <Notice tone="danger" message="Não foi possível guardar o percurso neste aparelho." /> : null}

              {healthConsent ? (
                <View style={styles.exerciseHeader}>
                  <View style={styles.flex}>
                    <AppText variant="bodyMedium">Frequência cardíaca média</AppText>
                    <AppText variant="caption" tone="muted">Dado de saúde: fica só com você.</AppText>
                  </View>
                  <View style={styles.stepper}>
                    <NumberField
                      label="Frequência cardíaca média"
                      value={avgHeartRate ?? 0}
                      onChange={(next) => setAvgHeartRate(next >= 30 ? next : null)}
                      min={0}
                      max={240}
                      step={5}
                      format={(next) => (next >= 30 ? `${next} bpm` : '—')}
                    />
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

          <AppText variant="caption" tone="muted">
            {isEndurance
              ? `Vai ser registrado como ${durationMinutes(current, now)} min de ${workoutTypeLabel(current.workoutType).toLowerCase()}${current.laps.length > 0 ? `, com ${current.laps.length} ${current.laps.length === 1 ? 'volta' : 'voltas'}` : ''}.`
              : `Vai ser registrado como ${durationMinutes(current, now)} min de ${workoutTypeLabel(current.workoutType).toLowerCase()}, com ${totalSets} ${totalSets === 1 ? 'série' : 'séries'}.`}
          </AppText>
          <Button
            label={finish.isPending ? 'Registrando…' : 'Registrar treino'}
            icon="check"
            onPress={() => finish.mutate()}
            disabled={finish.isPending || (!isEndurance && totalSets === 0)}
          />
          {!isEndurance && totalSets === 0 ? <Notice message="Marque ao menos uma série antes de registrar." /> : null}
          {finish.isError ? <Notice tone="danger" message={errorMessage(finish.error)} /> : null}
          <Button
            label="Voltar ao treino"
            variant="ghost"
            onPress={() => {
              // O relógio só volta a correr se foi o "Finalizar" que o parou.
              if (pausedToFinish) void session.resume();
              setPausedToFinish(false);
              setFinishing(false);
            }}
            disabled={finish.isPending}
          />
        </View>
      ) : (
        <>
          <Button
            label="Finalizar treino"
            icon="check"
            onPress={() => {
              // Com GPS, a distância do fim já vem medida (em passos de 10 m); a pessoa confere.
              const gps = gpsEnabled ? currentTrack(current.requestId).distanceM : 0;
              if (distanceM === null && gps >= DISTANCE.min) {
                setDistanceM(Math.min(DISTANCE.max, Math.round(gps / 10) * 10));
                setDistanceFromGps(true);
              }
              // Ao finalizar, o relógio para: a duração registrada é a de quando a pessoa encerrou,
              // não a de quando terminou de preencher (teste de 27/09).
              if (!current.pausedAt) {
                void session.pause();
                setPausedToFinish(true);
              }
              setFinishing(true);
            }}
          />
          <Button
            label="Descartar sessão"
            variant="ghost"
            icon="excluir"
            onPress={() => {
              clearTrack();
              void session.discard();
              router.replace('/');
            }}
          />
        </>
      )}
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  hero: {
    alignItems: 'center',
    gap: space.xs,
  },
  clock: {
    alignItems: 'center',
    gap: space.sm,
  },
  clockActions: {
    alignSelf: 'stretch',
  },
  center: {
    textAlign: 'center',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  block: {
    gap: space.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: touchTarget - 8,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  laps: {
    gap: space.xs,
  },
  lapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
    borderBottomWidth: 1,
  },
  exercise: {
    gap: space.sm,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
  },
  control: {
    gap: space.xs,
  },
  navRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  navCell: {
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  stepperValue: {
    minWidth: 68,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stepButton: {
    width: touchTarget - 8,
    height: touchTarget - 8,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setActions: {
    gap: space.xs,
  },
  doneOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    flex: 1,
  },
  pill: {
    height: 6,
    flexGrow: 1,
    flexBasis: 10,
    borderRadius: 3,
  },
  series: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    alignItems: 'center',
  },
  serie: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typed: {
    flex: 1,
  },
  setButton: {
    minHeight: touchTarget,
    borderWidth: 1.5,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
