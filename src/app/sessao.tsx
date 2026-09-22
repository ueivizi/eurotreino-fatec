import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { RollingNumber } from '@/components/motion/rolling-number';
import { ScreenHeader } from '@/components/screen-header';
import { Button, tapFeedback } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useProfile } from '@/features/auth/session';
import { healthConnect } from '@/features/devices/health-connect';
import { matchingWorkout } from '@/features/devices/imported-workout';
import { requestExercise, takePickedExercise } from '@/features/training/exercise-picker';
import { fetchExerciseCatalog } from '@/features/training/exercises-api';
import { fetchMyRoutines } from '@/features/training/routines-api';
import {
  MAX_SESSION_HOURS,
  durationMinutes,
  elapsedMs,
  finishSession,
  formatElapsed,
  isTooLong,
  lapDurations,
  setsOf,
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

function StepButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.stepButton, { borderColor: colors.hairline, opacity: disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={16} color={colors.gold} strokeWidth={1.8} />
    </Pressable>
  );
}

/**
 * Sessão de treino ao vivo. O cronômetro conta a partir dos instantes guardados no aparelho, então
 * fechar o app, trancar a tela ou ficar sem bateria não perde o treino. Só ao finalizar é que o
 * registro vai para o servidor — e lá a Glória continua vindo da regra v1 de sempre.
 */
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

export default function LiveSessionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ ficha?: string }>();
  const session = useTrainingSession();
  const profile = useProfile();
  const healthConsent = profile?.healthConsentAt !== null && profile?.healthConsentAt !== undefined;

  const routines = useQuery({ queryKey: queryKeys.routines, queryFn: fetchMyRoutines });
  const catalog = useQuery({ queryKey: queryKeys.exercises, queryFn: fetchExerciseCatalog, staleTime: 10 * 60_000 });

  const [now, setNow] = useState(() => new Date());
  const [type, setType] = useState<WorkoutTypeId>('musculacao');
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [avgHeartRate, setAvgHeartRate] = useState<number | null>(null);
  const [intensity, setIntensity] = useState<IntensityId>('moderado');
  const [reps, setReps] = useState<Record<string, number>>({});
  const [loads, setLoads] = useState<Record<string, number>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  /* Um exercício por vez, na ordem da ficha: a lista inteira na tela fazia perder o lugar entre
     uma série e outra (achado do teste de 22/09). */
  const [focusIndex, setFocusIndex] = useState(0);
  /** Exercício que acabou de fechar o previsto, e para qual índice ir depois do selo. */
  const [doneExercise, setDoneExercise] = useState<{ id: string; next: number } | null>(null);
  const [typing, setTyping] = useState<'reps' | 'carga' | null>(null);
  const [outcome, setOutcome] = useState<StrengthOutcome | null>(null);

  const current = session.current;

  // O selo de exercício concluído fica um instante e passa a vez ao próximo da ficha.
  useEffect(() => {
    if (!doneExercise) return;
    const { next } = doneExercise;
    const timer = setTimeout(() => {
      setDoneExercise(null);
      if (next >= 0) setFocusIndex(next);
    }, 1400);
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
      await session.discard();
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.honor });
      void queryClient.invalidateQueries({ queryKey: queryKeys.records });
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
    await session.start({ workoutType: type, requestId: randomUUID(), routineId });
    setNow(new Date());
  }

  function nameOf(exerciseId: string): string {
    return catalog.data?.exercises.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
  }

  // Resultado: a sessão acabou e virou treino.
  if (outcome) {
    return (
      <ScrollView
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
              Honra é sua progressão pessoal. A Arena continua disputando Glória.
            </AppText>
          </Card>
        ) : null}

        <Button label="Ver minha Honra" variant="secondary" onPress={() => router.replace('/honra')} />
        <Button label="Fechar" onPress={() => router.replace('/')} />
      </ScrollView>
    );
  }

  // Sem sessão: escolher por onde começar.
  if (!current) {
    return (
      <ScrollView
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
                <Button label="Começar agora" icon="registrar" onPress={() => void begin(null)} />
                <Notice message="Marque voltas durante o treino e informe a distância no fim. O app não usa GPS: nada de localização é coletado." />
              </>
            )}
            <Notice message="O cronômetro fica no aparelho: pode trancar a tela ou fechar o app que a sessão continua de pé." />
          </>
        )}
      </ScrollView>
    );
  }

  const elapsed = elapsedMs(current, now);
  const isEndurance = workoutModule(current.workoutType) === 'resistencia';
  const plannedIds = isEndurance ? [] : routine?.items.map((item) => item.exerciseId) ?? [];
  const exerciseIds = isEndurance ? [] : [...plannedIds, ...extra.filter((id) => !plannedIds.includes(id))];
  const totalSets = current.sets.length;

  const plannedFor = (exerciseId: string) => routine?.items.find((item) => item.exerciseId === exerciseId) ?? null;
  const completed = (exerciseId: string) => {
    const planned = plannedFor(exerciseId);
    return planned !== null && setsOf(current, exerciseId).length >= planned.targetSets;
  };
  const focusId = exerciseIds[Math.min(focusIndex, Math.max(exerciseIds.length - 1, 0))] ?? null;

  return (
    <ScrollView
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
          const repsValue = reps[focusId] ?? planned?.targetReps ?? 10;
          const loadValue = loads[focusId] ?? planned?.targetLoadKg ?? 0;
          const target = planned?.targetSets ?? Math.max(done.length + 1, 1);

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

                {typing === 'reps' ? (
                  <TextField
                    label="Repetições"
                    value={String(repsValue)}
                    onChangeText={(text) => {
                      const digits = Number(text.replace(/[^0-9]/g, ''));
                      setReps({ ...reps, [focusId]: Math.min(REPS.max, Math.max(REPS.min, digits || REPS.min)) });
                    }}
                    keyboardType="number-pad"
                    autoFocus
                    returnKeyType="done"
                    onBlur={() => setTyping(null)}
                    onSubmitEditing={() => setTyping(null)}
                    hint="Toque em concluído para voltar aos botões"
                  />
                ) : typing === 'carga' ? (
                  <TextField
                    label="Carga (kg)"
                    value={loadValue > 0 ? String(loadValue) : ''}
                    onChangeText={(text) => {
                      const clean = Number(text.replace(',', '.').replace(/[^0-9.]/g, ''));
                      setLoads({ ...loads, [focusId]: Number.isFinite(clean) ? Math.min(LOAD.max, Math.max(0, clean)) : 0 });
                    }}
                    keyboardType="decimal-pad"
                    autoFocus
                    returnKeyType="done"
                    onBlur={() => setTyping(null)}
                    onSubmitEditing={() => setTyping(null)}
                    hint="Vazio quer dizer peso livre"
                  />
                ) : (
                  <View style={styles.controls}>
                    <View style={styles.control}>
                      <AppText variant="caption" tone="muted">Repetições</AppText>
                      <View style={styles.stepper}>
                        <StepButton icon="menos" label="Menos repetições" disabled={repsValue <= REPS.min} onPress={() => setReps({ ...reps, [focusId]: repsValue - 1 })} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${repsValue} repetições. Toque para digitar.`}
                          onPress={() => {
                            tapFeedback();
                            setTyping('reps');
                          }}
                          style={styles.typed}>
                          <AppText variant="bodyMedium" style={styles.stepperValue}>{String(repsValue)}</AppText>
                        </Pressable>
                        <StepButton icon="mais" label="Mais repetições" disabled={repsValue >= REPS.max} onPress={() => setReps({ ...reps, [focusId]: repsValue + 1 })} />
                      </View>
                    </View>
                    <View style={styles.control}>
                      <AppText variant="caption" tone="muted">Carga</AppText>
                      <View style={styles.stepper}>
                        <StepButton icon="menos" label="Menos carga" disabled={loadValue <= 0} onPress={() => setLoads({ ...loads, [focusId]: Math.max(0, loadValue - LOAD.step) })} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${loadValue > 0 ? `${loadValue} quilos` : 'Peso livre'}. Toque para digitar.`}
                          onPress={() => {
                            tapFeedback();
                            setTyping('carga');
                          }}
                          style={styles.typed}>
                          <AppText variant="bodyMedium" style={styles.stepperValue}>{loadValue > 0 ? formatLoad(loadValue) : 'Livre'}</AppText>
                        </Pressable>
                        <StepButton icon="mais" label="Mais carga" disabled={loadValue >= LOAD.max} onPress={() => setLoads({ ...loads, [focusId]: Math.min(LOAD.max, loadValue + LOAD.step) })} />
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.setActions}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Marcar série de ${nameOf(focusId)}`}
                    haptic="tap"
                    onPress={() => {
                      void session.addSet({ exerciseId: focusId, reps: repsValue, loadKg: loadValue > 0 ? loadValue : null });
                      // A ficha manda: fechou o previsto, o exercício se dá por concluído e a vez
                      // passa para o próximo que ainda falta.
                      if (planned && done.length + 1 >= planned.targetSets) {
                        const next = exerciseIds.findIndex((id, index) => index > focusIndex && !completed(id));
                        setDoneExercise({ id: focusId, next });
                      }
                    }}
                    style={[styles.setButton, { backgroundColor: colors.selectedFill, borderColor: colors.gold }]}>
                    <Icon name="check" size={20} color={colors.goldHighlight} />
                    <AppText variant="button" tone="goldHighlight">Série feita</AppText>
                  </PressableScale>
                </View>

                <View style={styles.controls}>
                  <Button label="Anterior" icon="chevronLeft" variant="ghost" onPress={() => setFocusIndex((index) => Math.max(0, index - 1))} />
                  {done.length > 0 ? <Button label="Desfazer série" variant="ghost" onPress={() => void session.removeLastSet(focusId)} /> : null}
                  <Button
                    label={focusIndex + 1 >= exerciseIds.length ? 'Fim da ficha' : 'Próximo'}
                    icon="chevronRight"
                    variant="ghost"
                    onPress={() => setFocusIndex((index) => Math.min(exerciseIds.length - 1, index + 1))}
                  />
                </View>

                {/* Último filho do cartão: assim o selo pinta por cima de tudo, em qualquer plataforma. */}
                {doneExercise?.id === focusId ? <ExerciseDone name={nameOf(focusId)} sets={done.length} /> : null}
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
                          setFocusIndex(index);
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
                  <StepButton
                    icon="menos"
                    label="Menos distância"
                    disabled={distanceM === null}
                    onPress={() => setDistanceM((value) => (value === null || value <= DISTANCE.step ? null : value - DISTANCE.step))}
                  />
                  <AppText variant="bodyMedium" style={styles.stepperValue}>
                    {distanceM === null ? '—' : formatDistance(distanceM)}
                  </AppText>
                  <StepButton
                    icon="mais"
                    label="Mais distância"
                    onPress={() => setDistanceM((value) => Math.min(DISTANCE.max, (value ?? 0) + DISTANCE.step))}
                  />
                </View>
              </View>

              {healthConsent ? (
                <View style={styles.exerciseHeader}>
                  <View style={styles.flex}>
                    <AppText variant="bodyMedium">Frequência cardíaca média</AppText>
                    <AppText variant="caption" tone="muted">Dado de saúde: fica só com você.</AppText>
                  </View>
                  <View style={styles.stepper}>
                    <StepButton
                      icon="menos"
                      label="Menos batimentos"
                      disabled={avgHeartRate === null}
                      onPress={() => setAvgHeartRate((value) => (value === null || value <= 30 ? null : value - 5))}
                    />
                    <AppText variant="bodyMedium" style={styles.stepperValue}>
                      {avgHeartRate === null ? '—' : `${avgHeartRate} bpm`}
                    </AppText>
                    <StepButton
                      icon="mais"
                      label="Mais batimentos"
                      onPress={() => setAvgHeartRate((value) => Math.min(240, (value ?? 135) + 5))}
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
          <Button label="Voltar ao treino" variant="ghost" onPress={() => setFinishing(false)} disabled={finish.isPending} />
        </View>
      ) : (
        <>
          <Button label="Finalizar treino" icon="check" onPress={() => setFinishing(true)} />
          <Button
            label="Descartar sessão"
            variant="ghost"
            icon="excluir"
            onPress={() => {
              void session.discard();
              router.replace('/');
            }}
          />
        </>
      )}
    </ScrollView>
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
