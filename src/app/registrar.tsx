import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, tapFeedback } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { fetchWeeklyRanking } from '@/features/arena/arena-api';
import type { WeeklyRanking } from '@/features/arena/arena-parsers';
import { enqueueCelebrations } from '@/features/celebrations/celebration-store';
import { celebrationsForWorkout, type ArenaSnapshot } from '@/features/celebrations/detect';
import { WorkoutResult } from '@/features/celebrations/workout-result';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { SCORING } from '@/features/ranks/scoring';
import { QueueFullError } from '@/features/workouts/offline-queue';
import { useOfflineQueue } from '@/features/workouts/offline-queue-provider';
import {
  DAY_LABELS,
  availableDayOffsets,
  clampPerformedAt,
  dayOffsetOf,
  describePerformedAt,
  formatTime,
  stepPerformedAt,
  suggestedPerformedAt,
  withDayOffset,
} from '@/features/workouts/performed-at';
import { workoutShareMessage } from '@/features/workouts/share-workout';
import {
  DURATION,
  INTENSITIES,
  WORKOUT_TYPES,
  intensityLabel,
  stepDuration,
  workoutTypeLabel,
  type IntensityId,
  type WorkoutTypeId,
} from '@/features/workouts/workout-types';
import { fetchMyProgress, logWorkout } from '@/features/workouts/workouts-api';
import type { LoggedWorkout } from '@/features/workouts/workouts-parsers';
import { queryKeys } from '@/lib/query-client';
import { ApiError, errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

const FALLBACK = { type: 'musculacao' as WorkoutTypeId, durationMin: 45, intensity: 'moderado' as IntensityId };

type Draft = { type: WorkoutTypeId; durationMin: number; intensity: IntensityId; performedAt: Date | null };
type ArenaChange = { legionId: string; legionName: string; before: number | null; after: number };
type Outcome =
  | { kind: 'logged'; logged: LoggedWorkout; arena: ArenaChange | null; snapshots: readonly ArenaSnapshot[]; previousTotalWorkouts: number | null }
  | { kind: 'queued'; performedAt: Date };

function StepButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.stepButton, { borderColor: colors.hairline, opacity: disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={18} color={colors.gold} strokeWidth={1.8} />
    </Pressable>
  );
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { borderColor: colors.hairline }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={String(option.id)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => {
              tapFeedback();
              onChange(option.id);
            }}
            style={[styles.segment, selected && { backgroundColor: colors.selectedFill, borderColor: colors.gold, borderWidth: 1 }]}>
            <AppText variant={selected ? 'button' : 'body'} tone={selected ? 'goldHighlight' : 'secondary'} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function workoutSummary(draft: Draft, now: Date): string {
  const base = `${workoutTypeLabel(draft.type)} · ${draft.durationMin} min · ${intensityLabel(draft.intensity)}`;
  return draft.performedAt ? `${base} · ${describePerformedAt(draft.performedAt, now).toLowerCase()}` : base;
}

/** Frase da Arena quando a posição melhorou; `null` quando não houve ganho a comemorar. */
function arenaMessage(arena: ArenaChange | null): string | null {
  if (!arena || arena.before === null || arena.after >= arena.before) return null;
  return arena.after === 1
    ? `Você assumiu o 1º lugar na Arena da ${arena.legionName}.`
    : `Você subiu para o ${arena.after}º lugar na Arena da ${arena.legionName}.`;
}

/**
 * Treino registrado e pontuado: a folha mostra a composição da Glória, e as cerimônias maiores
 * (Ascensão, nova divisão, Arena, constância) tocam sobre as abas quando a folha fecha.
 */
function LoggedResult({
  outcome,
  draft,
  now,
  onClose,
  onOpenArena,
}: {
  outcome: Extract<Outcome, { kind: 'logged' }>;
  draft: Draft;
  now: Date;
  onClose: () => void;
  onOpenArena: (legionId: string) => void;
}) {
  const { arena } = outcome;
  return (
    <WorkoutResult
      result={outcome.logged}
      summary={workoutSummary(draft, now)}
      intensityLabel={intensityLabel(draft.intensity)}
      arenaLine={arenaMessage(arena)}
      shareMessage={workoutShareMessage({
        type: draft.type,
        durationMin: draft.durationMin,
        intensity: draft.intensity,
        result: outcome.logged,
      })}
      onClose={onClose}
      onOpenArena={arena ? () => onOpenArena(arena.legionId) : undefined}
    />
  );
}

/** Treino guardado sem conexão (NF008): a Glória vem quando ele chegar ao servidor. */
function QueuedResult({ draft, performedAt, onClose }: { draft: Draft; performedAt: Date; onClose: () => void }) {
  const { colors } = useTheme();
  const queue = useOfflineQueue();
  const [now] = useState(() => new Date());
  const [sent, setSent] = useState<boolean | null>(null);

  async function retry() {
    const summary = await queue.flush();
    setSent(summary.sent > 0);
  }

  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      <View style={[styles.circle, { borderColor: colors.hairline }]}>
        <Icon name="nuvem" size={36} color={colors.gold} />
      </View>
      <AppText variant="heading">Sem conexão</AppText>
      <AppText tone="secondary" style={styles.center}>
        Seu treino foi guardado neste aparelho e será enviado quando a internet voltar.
      </AppText>
      <Card style={styles.pendingCard}>
        <Icon name={WORKOUT_TYPES.find((item) => item.id === draft.type)?.icon ?? 'outro'} size={26} color={colors.gold} />
        <View style={styles.flex}>
          <AppText variant="bodyMedium">{`${workoutTypeLabel(draft.type)} · ${draft.durationMin} min`}</AppText>
          <AppText variant="caption" tone="muted">
            {`${intensityLabel(draft.intensity)} · ${describePerformedAt(performedAt, now).toLowerCase()}`}
          </AppText>
        </View>
        <AppText variant="caption" tone="gold">Aguardando envio</AppText>
      </Card>
      <AppText variant="caption" tone="muted" style={styles.center}>
        A Glória é calculada quando o treino chega ao servidor, assim a Arena fica justa para todos.
      </AppText>
      {sent === true ? <Notice message="Enviado! Sua Glória já aparece no Início." /> : null}
      {sent === false ? <Notice tone="danger" message="Ainda sem conexão. O treino continua guardado e vai ser enviado depois." /> : null}
      <View style={styles.fullWidth}>
        <Button label="Entendi" onPress={onClose} />
      </View>
      {sent !== true ? (
        <View style={styles.fullWidth}>
          <Button label={queue.flushing ? 'Enviando…' : 'Tentar enviar agora'} variant="ghost" onPress={() => void retry()} disabled={queue.flushing} />
        </View>
      ) : null}
    </View>
  );
}

/** RF006: registrar treino em até 3 toques (tipo → Concluí), com o último treino já preenchido. */
export default function RegisterWorkoutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const queue = useOfflineQueue();
  const progress = useQuery({ queryKey: queryKeys.progress, queryFn: fetchMyProgress });
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });

  // Os padrões repetem o último treino já conhecido: o fluxo comum é tocar no tipo e em "Concluí".
  const [initial] = useState(() => progress.data?.lastWorkout ?? FALLBACK);
  const [type, setType] = useState<WorkoutTypeId>(initial.type);
  const [minutes, setMinutes] = useState<number>(initial.durationMin);
  const [intensity, setIntensity] = useState<IntensityId>(initial.intensity);
  const [performedAt, setPerformedAt] = useState<Date | null>(null);
  const [choosingTime, setChoosingTime] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Um identificador por registro: reenviar depois de uma falha de rede não pontua duas vezes.
  const [requestId, setRequestId] = useState(() => randomUUID());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const draft: Draft = { type, durationMin: minutes, intensity, performedAt };

  const save = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      const legion = legions.data?.[0] ?? null;
      const cached = legion ? queryClient.getQueryData<WeeklyRanking>(queryKeys.ranking(legion.id, 0)) : undefined;
      const beforeEntries = cached?.entries ?? null;
      const before = beforeEntries?.find((entry) => entry.isMe)?.place ?? null;
      const previousTotalWorkouts = progress.data?.totalWorkouts ?? null;
      const at = performedAt ? clampPerformedAt(performedAt, new Date()) : null;

      let logged: LoggedWorkout;
      try {
        logged = await logWorkout({ requestId, type, durationMin: minutes, intensity, performedAt: at ?? undefined });
      } catch (error) {
        if (!(error instanceof ApiError && error.network)) throw error;
        // Sem conexão: guarda com o horário real do treino e envia depois com o mesmo identificador.
        const queuedAt = at ?? new Date();
        await queue.add({ requestId, type, durationMin: minutes, intensity, performedAt: queuedAt.toISOString() });
        return { kind: 'queued', performedAt: queuedAt };
      }

      let arena: ArenaChange | null = null;
      const snapshots: ArenaSnapshot[] = [];
      if (legion && logged.isScored && !logged.replayed) {
        try {
          const ranking = await queryClient.fetchQuery({
            queryKey: queryKeys.ranking(legion.id, 0),
            queryFn: () => fetchWeeklyRanking(legion.id, 0),
            staleTime: 0,
          });
          const me = ranking.entries.find((entry) => entry.isMe);
          if (me) arena = { legionId: legion.id, legionName: legion.name, before, after: me.place };
          // Sem o ranking anterior em cache não há como saber quem foi ultrapassado: sem cena da Arena.
          if (beforeEntries) {
            snapshots.push({ legionId: legion.id, legionName: legion.name, before: beforeEntries, after: ranking.entries });
          }
        } catch {
          // A posição na Arena é um extra do resultado; o treino já foi registrado.
        }
      }
      return { kind: 'logged', logged, arena, snapshots, previousTotalWorkouts };
    },
    onSuccess: (outcome) => {
      if (outcome.kind === 'logged') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
        void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
        // As cerimônias ficam na fila e tocam quando a folha fecha, sobre as abas.
        enqueueCelebrations(
          celebrationsForWorkout({
            result: outcome.logged,
            previousTotalWorkouts: outcome.previousTotalWorkouts,
            arenas: outcome.snapshots,
          }),
        );
      }
    },
  });

  function change(apply: () => void) {
    apply();
    // Dados diferentes são outro registro; o identificador antigo ficaria em conflito no servidor.
    if (save.isError) {
      setRequestId(randomUUID());
      save.reset();
    }
  }

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const openArena = (legionId: string) => {
    close();
    router.navigate({ pathname: '/arena', params: { legiao: legionId } });
  };

  const days = availableDayOffsets(now);
  const dayValue = performedAt ? dayOffsetOf(performedAt, now) : -1;
  const dayOptions = [{ id: -1, label: 'Agora' }, ...days.map((offset) => ({ id: offset, label: DAY_LABELS[offset] }))];
  const disabled = save.isPending;

  const saveError =
    save.error instanceof QueueFullError
      ? 'Há muitos treinos guardados neste aparelho aguardando envio. Conecte-se à internet para enviá-los antes de registrar outro.'
      : save.isError
        ? errorMessage(save.error)
        : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceRaised }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="heading">{save.isSuccess ? 'Treino registrado' : 'Registrar treino'}</AppText>
          {!save.isSuccess ? <AppText variant="label" tone="muted">Toque no tipo e depois em Concluí.</AppText> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={close} style={styles.close}>
          <Icon name="fechar" size={22} color={colors.gold} strokeWidth={1.6} />
        </Pressable>
      </View>

      {save.isSuccess ? (
        save.data.kind === 'queued' ? (
          <QueuedResult draft={draft} performedAt={save.data.performedAt} onClose={close} />
        ) : (
          <LoggedResult outcome={save.data} draft={draft} now={now} onClose={close} onOpenArena={openArena} />
        )
      ) : (
        <>
          <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Tipo de treino">
            {WORKOUT_TYPES.map((option) => {
              const selected = option.id === type;
              const color = selected ? colors.goldHighlight : colors.textSecondary;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: selected, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    tapFeedback();
                    change(() => setType(option.id));
                  }}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: selected ? colors.selectedFill : colors.surface,
                      borderColor: selected ? colors.gold : colors.hairlineSoft,
                      borderWidth: selected ? 1.5 : 1,
                    },
                  ]}>
                  <Icon name={option.icon} size={26} color={color} />
                  <AppText variant="label" style={{ color }}>{option.label}</AppText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row}>
            <View style={styles.headerText}>
              <AppText variant="bodyMedium">Duração</AppText>
              <AppText variant="caption" tone="muted">
                {progress.data?.lastWorkout ? 'Igual ao último treino' : 'Ajuste se precisar'}
              </AppText>
            </View>
            <View style={styles.stepper}>
              <StepButton
                icon="menos"
                label="Diminuir 5 minutos"
                disabled={disabled || minutes <= DURATION.min}
                onPress={() => change(() => setMinutes((value) => stepDuration(value, -1)))}
              />
              <AppText variant="bodyMedium" style={styles.value} accessibilityLiveRegion="polite">{`${minutes} min`}</AppText>
              <StepButton
                icon="mais"
                label="Aumentar 5 minutos"
                disabled={disabled || minutes >= DURATION.max}
                onPress={() => change(() => setMinutes((value) => stepDuration(value, 1)))}
              />
            </View>
          </View>

          <View style={styles.group}>
            <AppText variant="bodyMedium">Intensidade</AppText>
            <Segmented label="Intensidade" options={INTENSITIES} value={intensity} onChange={(id) => change(() => setIntensity(id))} disabled={disabled} />
          </View>

          <View style={styles.group}>
            <View style={styles.row}>
              <View style={styles.headerText}>
                <AppText variant="bodyMedium">Quando</AppText>
                <AppText variant="caption" tone="muted">
                  {performedAt ? `Vale para treinos das últimas ${SCORING.lateLogHours} horas` : 'Treino que acabou de terminar'}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quando: ${describePerformedAt(performedAt, now)}. ${choosingTime ? 'Fechar escolha de horário' : 'Escolher outro horário'}`}
                accessibilityState={{ expanded: choosingTime, disabled }}
                disabled={disabled}
                onPress={() => {
                  tapFeedback();
                  setNow(new Date());
                  setChoosingTime((open) => !open);
                }}
                style={[styles.whenChip, { borderColor: performedAt ? colors.gold : colors.hairline }]}>
                <Icon name="relogio" size={18} color={colors.gold} />
                <AppText variant="label" tone={performedAt ? 'goldHighlight' : 'secondary'}>{describePerformedAt(performedAt, now)}</AppText>
              </Pressable>
            </View>

            {choosingTime ? (
              <View style={styles.group}>
                <Segmented
                  label="Dia do treino"
                  options={dayOptions}
                  value={dayValue}
                  disabled={disabled}
                  onChange={(offset) =>
                    change(() => {
                      const current = new Date();
                      setNow(current);
                      setPerformedAt(offset === -1 ? null : withDayOffset(performedAt ?? suggestedPerformedAt(current), offset, current));
                    })
                  }
                />
                {performedAt ? (
                  <View style={styles.row}>
                    <AppText variant="label" tone="secondary">Horário em que terminou</AppText>
                    <View style={styles.stepper}>
                      <StepButton
                        icon="menos"
                        label="15 minutos antes"
                        disabled={disabled || stepPerformedAt(performedAt, -1, now) === null}
                        onPress={() => change(() => setPerformedAt((value) => (value ? stepPerformedAt(value, -1, new Date()) ?? value : value)))}
                      />
                      <AppText variant="bodyMedium" style={styles.value} accessibilityLiveRegion="polite">{formatTime(performedAt)}</AppText>
                      <StepButton
                        icon="mais"
                        label="15 minutos depois"
                        disabled={disabled || stepPerformedAt(performedAt, 1, now) === null}
                        onPress={() => change(() => setPerformedAt((value) => (value ? stepPerformedAt(value, 1, new Date()) ?? value : value)))}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <Button
            label={save.isPending ? 'Registrando…' : save.isError ? 'Tentar de novo' : 'Concluí'}
            icon="check"
            onPress={() => save.mutate()}
            disabled={disabled}
          />
          {saveError ? <Notice tone="danger" message={saveError} /> : null}
          {queue.pending.length > 0 ? (
            <AppText variant="caption" tone="muted" style={styles.center}>
              {`${queue.pending.length} ${queue.pending.length === 1 ? 'treino aguarda' : 'treinos aguardam'} envio neste aparelho.`}
            </AppText>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.xxxl,
    gap: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: {
    flexShrink: 1,
    gap: space.xs,
  },
  close: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space.md,
    marginTop: -space.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.md,
  },
  typeChip: {
    width: '31.5%',
    height: 84,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  stepButton: {
    width: touchTarget,
    height: touchTarget,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 76,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  group: {
    gap: space.sm,
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
    paddingHorizontal: space.xs,
  },
  whenChip: {
    minHeight: touchTarget - 4,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  result: {
    alignItems: 'center',
    gap: space.md,
  },
  motto: {
    gap: 2,
    alignItems: 'center',
  },
  breakdown: {
    alignSelf: 'stretch',
    gap: space.xs,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(201,162,74,0.22)',
    marginVertical: space.xs,
  },
  resultLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
  },
  rankCard: {
    alignSelf: 'stretch',
    gap: space.sm,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  pendingCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  center: {
    textAlign: 'center',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
