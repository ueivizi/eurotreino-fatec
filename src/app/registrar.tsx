import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { RankMedallion } from '@/components/rank/rank-medallion';
import { Button, tapFeedback } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { fetchWeeklyRanking } from '@/features/arena/arena-api';
import type { WeeklyRanking } from '@/features/arena/arena-parsers';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { SCORING } from '@/features/ranks/scoring';
import { rankFromGlory } from '@/features/ranks/tiers';
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
type Outcome = { kind: 'logged'; logged: LoggedWorkout; arena: ArenaChange | null } | { kind: 'queued'; performedAt: Date };

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

function ResultLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={styles.resultLine}>
      <AppText tone={strong ? 'primary' : 'secondary'} variant={strong ? 'bodyMedium' : 'body'}>{label}</AppText>
      <AppText variant="bodyMedium" tone="goldHighlight" style={styles.tabular}>{`+${value}`}</AppText>
    </View>
  );
}

function workoutSummary(draft: Draft, now: Date): string {
  const base = `${workoutTypeLabel(draft.type)} · ${draft.durationMin} min · ${intensityLabel(draft.intensity)}`;
  return draft.performedAt ? `${base} · ${describePerformedAt(draft.performedAt, now).toLowerCase()}` : base;
}

function arenaMessage(arena: ArenaChange | null): string | null {
  if (!arena || arena.before === null || arena.after >= arena.before) return null;
  return arena.after === 1
    ? `Você assumiu o 1º lugar na Arena da ${arena.legionName}.`
    : `Você subiu para o ${arena.after}º lugar na Arena da ${arena.legionName}.`;
}

/** Cerimônia de Ascensão: novo rank ou nova divisão. */
function Ascension({ totalGlory, onContinue }: { totalGlory: number; onContinue: () => void }) {
  const rank = rankFromGlory(totalGlory);
  async function share() {
    try {
      await Share.share({
        message: `Cheguei a ${rank.label} no EuroTreino, com ${rank.glory} de Glória. Per aspera ad astra!`,
      });
    } catch {
      // Sem folha de compartilhamento disponível: a cerimônia segue normalmente.
    }
  }
  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      <AppText variant="overline" tone="gold">Ascensão</AppText>
      <RankMedallion tier={rank.tierId} size={168} accessibilityLabel={`Novo rank: ${rank.label}`} />
      {rank.division ? <AppText variant="heading" tone="goldHighlight">{rank.division}</AppText> : null}
      <AppText variant="title" style={styles.center}>{rank.tierName}</AppText>
      <View style={styles.motto}>
        <AppText variant="motto" tone="gold" style={styles.center}>Per aspera ad astra</AppText>
        <AppText variant="label" tone="muted" style={styles.center}>Por caminhos ásperos até as estrelas</AppText>
      </View>
      <View style={styles.motto}>
        <AppText tone="secondary" style={[styles.center, styles.tabular]}>{`Você chegou a ${rank.glory} de Glória.`}</AppText>
        {rank.next ? (
          <AppText tone="secondary" style={[styles.center, styles.tabular]}>{`Próxima divisão: ${rank.next.label}, com ${rank.next.min}.`}</AppText>
        ) : (
          <AppText tone="secondary" style={styles.center}>Você está no topo do Olimpo.</AppText>
        )}
        <AppText tone="secondary" style={styles.center}>Sua Glória nunca é perdida.</AppText>
      </View>
      <View style={styles.fullWidth}>
        <Button label="Continuar" onPress={onContinue} />
      </View>
      <View style={styles.fullWidth}>
        <Button label="Compartilhar com a Legião" icon="compartilhar" variant="ghost" onPress={() => void share()} />
      </View>
    </View>
  );
}

function WorkoutResult({
  outcome,
  draft,
  onClose,
  onOpenArena,
}: {
  outcome: Extract<Outcome, { kind: 'logged' }>;
  draft: Draft;
  onClose: () => void;
  onOpenArena: (legionId: string) => void;
}) {
  const { logged, arena } = outcome;
  const [now] = useState(() => new Date());
  const before = rankFromGlory(Math.max(0, logged.totalGlory - logged.points));
  const after = rankFromGlory(logged.totalGlory);
  const ascended = !logged.replayed && after.label !== before.label;
  const [ceremony, setCeremony] = useState(ascended);

  if (ceremony) return <Ascension totalGlory={logged.totalGlory} onContinue={() => setCeremony(false)} />;

  const message = arenaMessage(arena);

  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      {logged.replayed ? (
        <>
          <AppText variant="heading">Treino já registrado</AppText>
          <Notice message="Este registro já tinha chegado ao servidor. Nada foi somado de novo." />
        </>
      ) : logged.isScored ? (
        <>
          <AppText variant="display" tone="goldHighlight" style={styles.tabular}>{`+${logged.points}`}</AppText>
          <AppText variant="subheading">Glória</AppText>
          <AppText variant="label" tone="muted" style={styles.center}>{workoutSummary(draft, now)}</AppText>
          <Card style={styles.breakdown}>
            <ResultLine label="Presença" value={logged.presence} />
            <ResultLine label={`Duração · ${draft.durationMin} min`} value={logged.duration} />
            <ResultLine label={`Intensidade · ${intensityLabel(draft.intensity).toLowerCase()}`} value={logged.intensity} />
            {logged.bonus > 0 ? <ResultLine label={`Constância · ${SCORING.weeklyBonusAt}º treino da semana`} value={logged.bonus} /> : null}
            <View style={styles.separator} />
            <ResultLine label="Total" value={logged.points} strong />
          </Card>
        </>
      ) : (
        <>
          <AppText variant="heading">Treino registrado</AppText>
          <Notice message={`Você já tem ${SCORING.maxScoredPerDay} treinos pontuados neste dia. Este fica no seu histórico, sem Glória.`} />
        </>
      )}

      <Card style={styles.rankCard}>
        <View style={styles.rankRow}>
          <RankMedallion tier={after.tierId} size={48} accessibilityLabel={after.label} />
          <View style={styles.flex}>
            <AppText variant="subheading">{after.label}</AppText>
            <AppText variant="label" tone="secondary" style={styles.tabular}>
              {logged.points > 0 && !logged.replayed ? `${before.glory} → ${after.glory}` : `${after.glory} de Glória`}
            </AppText>
          </View>
        </View>
        <ProgressBar value={after.progress} accessibilityLabel={after.next ? `Progresso até ${after.next.label}` : 'Rank máximo alcançado'} />
        <AppText variant="caption" tone="secondary" style={styles.tabular}>
          {after.next ? `Faltam ${after.next.remaining} para ${after.next.label}` : 'Você chegou ao Olimpo'}
        </AppText>
      </Card>

      {message ? <Notice message={message} /> : null}

      <AppText variant="caption" tone="muted" style={styles.tabular}>{`Glória da semana: ${logged.weekGlory}`}</AppText>

      {arena ? (
        <View style={styles.fullWidth}>
          <Button label="Ver Arena" icon="arena" variant="secondary" onPress={() => onOpenArena(arena.legionId)} />
        </View>
      ) : null}
      <View style={styles.fullWidth}>
        <Button label="Fechar" onPress={onClose} />
      </View>
    </View>
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
      const before = cached?.entries.find((entry) => entry.isMe)?.place ?? null;
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
      if (legion && logged.isScored && !logged.replayed) {
        try {
          const ranking = await queryClient.fetchQuery({
            queryKey: queryKeys.ranking(legion.id, 0),
            queryFn: () => fetchWeeklyRanking(legion.id, 0),
            staleTime: 0,
          });
          const me = ranking.entries.find((entry) => entry.isMe);
          if (me) arena = { legionId: legion.id, legionName: legion.name, before, after: me.place };
        } catch {
          // A posição na Arena é um extra do resultado; o treino já foi registrado.
        }
      }
      return { kind: 'logged', logged, arena };
    },
    onSuccess: (outcome) => {
      if (outcome.kind === 'logged') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
        void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
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
          <WorkoutResult outcome={save.data} draft={draft} onClose={close} onOpenArena={openArena} />
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
