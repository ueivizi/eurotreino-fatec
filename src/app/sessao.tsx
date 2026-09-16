import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { RollingNumber } from '@/components/motion/rolling-number';
import { ScreenHeader } from '@/components/screen-header';
import { Button, tapFeedback } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { requestExercise, takePickedExercise } from '@/features/training/exercise-picker';
import { fetchExerciseCatalog } from '@/features/training/exercises-api';
import { fetchMyRoutines } from '@/features/training/routines-api';
import { MAX_SESSION_HOURS, durationMinutes, elapsedMs, finishSession, formatElapsed, isTooLong, setsOf } from '@/features/training/session';
import { useTrainingSession } from '@/features/training/session-provider';
import { logStrengthWorkout, type StrengthOutcome } from '@/features/training/strength-api';
import { formatLoad } from '@/features/workouts/metrics';
import { INTENSITIES, LOAD, type IntensityId } from '@/features/workouts/workout-types';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

const REPS = { min: 1, max: 100, step: 1 } as const;

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
export default function LiveSessionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ ficha?: string }>();
  const session = useTrainingSession();

  const routines = useQuery({ queryKey: queryKeys.routines, queryFn: fetchMyRoutines });
  const catalog = useQuery({ queryKey: queryKeys.exercises, queryFn: fetchExerciseCatalog, staleTime: 10 * 60_000 });

  const [now, setNow] = useState(() => new Date());
  const [intensity, setIntensity] = useState<IntensityId>('moderado');
  const [reps, setReps] = useState<Record<string, number>>({});
  const [loads, setLoads] = useState<Record<string, number>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [outcome, setOutcome] = useState<StrengthOutcome | null>(null);

  const current = session.current;

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
    mutationFn: async () => {
      if (!current) throw new Error('sem sessão');
      const finished = finishSession(current, intensity, new Date());
      if (!finished) throw new Error('intensidade inválida');
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

  async function begin(routineId: string | null) {
    await session.start({ workoutType: 'musculacao', requestId: randomUUID(), routineId });
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
            {routines.isPending ? <ActivityIndicator color={colors.gold} /> : null}
            {(routines.data ?? []).map((item) => (
              <Button
                key={item.id}
                label={item.name}
                icon="registrar"
                variant={params.ficha === item.id ? 'primary' : 'secondary'}
                onPress={() => void begin(item.id)}
              />
            ))}
            <Button label="Treino livre, sem ficha" variant="ghost" onPress={() => void begin(null)} />
            <Notice message="O cronômetro fica no aparelho: pode trancar a tela ou fechar o app que a sessão continua de pé." />
            <Button label="Montar uma ficha" variant="ghost" icon="mais" onPress={() => router.push('/fichas')} />
          </>
        )}
      </ScrollView>
    );
  }

  const elapsed = elapsedMs(current, now);
  const plannedIds = routine?.items.map((item) => item.exerciseId) ?? [];
  const exerciseIds = [...plannedIds, ...extra.filter((id) => !plannedIds.includes(id))];
  const totalSets = current.sets.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <View style={styles.clock}>
        <AppText variant="overline" tone="muted">{routine ? routine.name : 'Treino livre'}</AppText>
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

      {exerciseIds.map((exerciseId) => {
        const planned = routine?.items.find((item) => item.exerciseId === exerciseId) ?? null;
        const done = setsOf(current, exerciseId);
        const repsValue = reps[exerciseId] ?? planned?.targetReps ?? 10;
        const loadValue = loads[exerciseId] ?? planned?.targetLoadKg ?? 0;

        return (
          <Card key={exerciseId} style={styles.exercise}>
            <View style={styles.exerciseHeader}>
              <View style={styles.flex}>
                <AppText variant="bodyMedium" numberOfLines={2}>{nameOf(exerciseId)}</AppText>
                <AppText variant="caption" tone="muted">
                  {planned
                    ? `Previsto: ${planned.targetSets}x${planned.targetReps}${planned.targetLoadKg ? ` · ${formatLoad(planned.targetLoadKg)}` : ''}`
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

            {done.length > 0 ? (
              <AppText variant="caption" tone="secondary">
                {done.map((set) => `${set.reps}${set.loadKg ? `×${formatLoad(set.loadKg)}` : ''}`).join(' · ')}
              </AppText>
            ) : null}

            <View style={styles.controls}>
              <View style={styles.control}>
                <AppText variant="caption" tone="muted">Repetições</AppText>
                <View style={styles.stepper}>
                  <StepButton icon="menos" label="Menos repetições" disabled={repsValue <= REPS.min} onPress={() => setReps({ ...reps, [exerciseId]: repsValue - 1 })} />
                  <AppText variant="bodyMedium" style={styles.stepperValue}>{String(repsValue)}</AppText>
                  <StepButton icon="mais" label="Mais repetições" disabled={repsValue >= REPS.max} onPress={() => setReps({ ...reps, [exerciseId]: repsValue + 1 })} />
                </View>
              </View>
              <View style={styles.control}>
                <AppText variant="caption" tone="muted">Carga</AppText>
                <View style={styles.stepper}>
                  <StepButton icon="menos" label="Menos carga" disabled={loadValue <= 0} onPress={() => setLoads({ ...loads, [exerciseId]: Math.max(0, loadValue - LOAD.step) })} />
                  <AppText variant="bodyMedium" style={styles.stepperValue}>{loadValue > 0 ? formatLoad(loadValue) : 'Livre'}</AppText>
                  <StepButton icon="mais" label="Mais carga" disabled={loadValue >= LOAD.max} onPress={() => setLoads({ ...loads, [exerciseId]: Math.min(LOAD.max, loadValue + LOAD.step) })} />
                </View>
              </View>
            </View>

            <View style={styles.setActions}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Marcar série de ${nameOf(exerciseId)}`}
                haptic="tap"
                onPress={() => void session.addSet({ exerciseId, reps: repsValue, loadKg: loadValue > 0 ? loadValue : null })}
                style={[styles.setButton, { backgroundColor: colors.selectedFill, borderColor: colors.gold }]}>
                <Icon name="check" size={20} color={colors.goldHighlight} />
                <AppText variant="button" tone="goldHighlight">Série feita</AppText>
              </PressableScale>
              {done.length > 0 ? (
                <Button label="Desfazer" variant="ghost" onPress={() => void session.removeLastSet(exerciseId)} />
              ) : null}
            </View>
          </Card>
        );
      })}

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
          <AppText variant="caption" tone="muted">
            {`Vai ser registrado como ${durationMinutes(current, now)} min de musculação, com ${totalSets} ${totalSets === 1 ? 'série' : 'séries'}.`}
          </AppText>
          <Button
            label={finish.isPending ? 'Registrando…' : 'Registrar treino'}
            icon="check"
            onPress={() => finish.mutate()}
            disabled={finish.isPending || totalSets === 0}
          />
          {totalSets === 0 ? <Notice message="Marque ao menos uma série antes de registrar." /> : null}
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
