import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, tapFeedback } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { NumberField } from '@/components/ui/number-field';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { fetchWeeklyRanking } from '@/features/arena/arena-api';
import { useProfile } from '@/features/auth/session';
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
import { workoutWarnings } from '@/features/workouts/coherence';
import { workoutShareMessage } from '@/features/workouts/share-workout';
import { formatDistance, formatLoad, performanceFor } from '@/features/workouts/metrics';
import {
  DISTANCE,
  DURATION,
  INTENSITIES,
  LOAD,
  NOTE_MAX_LENGTH,
  SETS,
  WORKOUT_TYPES,
  intensityLabel,
  workoutModule,
  workoutTypeLabel,
  type IntensityId,
  type WorkoutTypeId,
} from '@/features/workouts/workout-types';
import { fetchMyProgress, logWorkout } from '@/features/workouts/workouts-api';
import type { LastWorkout, LoggedWorkout } from '@/features/workouts/workouts-parsers';
import { queryKeys } from '@/lib/query-client';
import { ApiError, errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

const FALLBACK: LastWorkout = {
  type: 'musculacao',
  durationMin: 45,
  intensity: 'moderado',
  distanceM: null,
  setsCount: null,
  loadKg: null,
  note: null,
};

type Draft = {
  type: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  performedAt: Date | null;
  /** Detalhes da modalidade, sempre opcionais. */
  distanceM: number | null;
  /** O que foi o treino, só na família "outro". Vazio quando não se aplica. */
  note: string;
  setsCount: number | null;
  loadKg: number | null;
  /** Medida de saúde: só existe com consentimento ligado no Perfil. */
  avgHeartRate: number | null;
};
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

/**
 * Detalhe opcional da modalidade (distância, séries, carga). Começa desligado: o fluxo de 3 toques
 * continua intacto para quem só quer registrar e sair. Quem liga, ajusta com os mesmos passos do
 * resto da tela, sem teclado.
 */
function DetailRow({
  label,
  hint,
  value,
  format,
  step,
  min,
  max,
  start,
  decimals,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  format: (value: number) => string;
  step: number;
  min: number;
  max: number;
  /** Valor sugerido ao ligar o detalhe. */
  start: number;
  /** Medidas que aceitam meio quilo ou meio quilômetro. */
  decimals?: boolean;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  const { colors } = useTheme();
  const active = value !== null;

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <View style={styles.headerText}>
          <AppText variant="bodyMedium">{label}</AppText>
          <AppText variant="caption" tone="muted">{active ? hint : 'Opcional'}</AppText>
        </View>
        {active ? (
          <View style={styles.stepper}>
            <NumberField
              label={label}
              value={value}
              onChange={onChange}
              min={min}
              max={max}
              step={step}
              format={format}
              decimals={decimals}
              disabled={disabled}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Informar ${label.toLowerCase()}`}
            disabled={disabled}
            onPress={() => {
              tapFeedback();
              onChange(start);
            }}
            style={[styles.whenChip, { borderColor: colors.hairline }]}>
            <Icon name="mais" size={16} color={colors.gold} />
            <AppText variant="label" tone="secondary">Informar</AppText>
          </Pressable>
        )}
      </View>
      {active ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remover ${label.toLowerCase()}`}
          disabled={disabled}
          onPress={() => {
            tapFeedback();
            onChange(null);
          }}
          style={styles.removeDetail}>
          <AppText variant="caption" tone="muted">Remover</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function workoutSummary(draft: Draft, now: Date): string {
  const parts = [workoutTypeLabel(draft.type), `${draft.durationMin} min`, intensityLabel(draft.intensity)];
  if (draft.note !== '') parts.splice(1, 0, draft.note);
  if (draft.distanceM !== null) {
    parts.push(formatDistance(draft.distanceM));
    const performance = performanceFor(draft.type, draft.distanceM, draft.durationMin);
    if (performance) parts.push(performance);
  }
  if (draft.setsCount !== null) parts.push(`${draft.setsCount} ${draft.setsCount === 1 ? 'série' : 'séries'}`);
  if (draft.loadKg !== null) parts.push(formatLoad(draft.loadKg));
  if (draft.performedAt) parts.push(describePerformedAt(draft.performedAt, now).toLowerCase());
  return parts.join(' · ');
}

/** Destaque dos detalhes da modalidade no resultado, ex.: "7,0 km · 4:17 /km". */
function detailLine(draft: Draft): string | null {
  const parts: string[] = [];
  if (draft.note !== '') parts.push(draft.note);
  if (draft.distanceM !== null) {
    parts.push(formatDistance(draft.distanceM));
    const performance = performanceFor(draft.type, draft.distanceM, draft.durationMin);
    if (performance) parts.push(performance);
  }
  if (draft.setsCount !== null) parts.push(`${draft.setsCount} ${draft.setsCount === 1 ? 'série' : 'séries'}`);
  if (draft.loadKg !== null) parts.push(formatLoad(draft.loadKg));
  return parts.length > 0 ? parts.join(' · ') : null;
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
      detailLine={detailLine(draft)}
      recordLine={
        outcome.logged.isDistanceRecord
          ? `Novo recorde de distância em ${workoutTypeLabel(draft.type).toLowerCase()}.`
          : null
      }
      shareMessage={workoutShareMessage({
        type: draft.type,
        durationMin: draft.durationMin,
        intensity: draft.intensity,
        result: outcome.logged,
        distanceM: draft.distanceM,
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
  const profile = useProfile();
  const healthConsent = profile?.healthConsentAt !== null && profile?.healthConsentAt !== undefined;
  const progress = useQuery({ queryKey: queryKeys.progress, queryFn: fetchMyProgress });
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });

  /*
   * Registrar e repetir são coisas diferentes, e misturá-las confundiu quem testou: um treino
   * novo começa limpo, e só "Repetir último" traz o treino anterior inteiro -- tipo, duração,
   * intensidade e os detalhes da modalidade.
   */
  const repeating = useLocalSearchParams<{ repetir?: string }>().repetir === '1';
  const [initial] = useState(() => (repeating ? (progress.data?.lastWorkout ?? FALLBACK) : FALLBACK));
  const [type, setType] = useState<WorkoutTypeId>(initial.type);
  const [minutes, setMinutes] = useState<number>(initial.durationMin);
  const [intensity, setIntensity] = useState<IntensityId>(initial.intensity);
  const [performedAt, setPerformedAt] = useState<Date | null>(null);
  const [choosingTime, setChoosingTime] = useState(false);
  // O `draft` só envia os detalhes da família do tipo escolhido.
  const [distanceM, setDistanceM] = useState<number | null>(initial.distanceM);
  // A frequência começa vazia de propósito: é medida, não preferência, e repetir a anterior
  // gravaria uma medição que não aconteceu. Quem tem a medida de verdade é o relógio.
  const [avgHeartRate, setAvgHeartRate] = useState<number | null>(null);
  const [setsCount, setSetsCount] = useState<number | null>(initial.setsCount);
  const [loadKg, setLoadKg] = useState<number | null>(initial.loadKg);
  const [note, setNote] = useState(initial.note ?? '');
  const [now, setNow] = useState(() => new Date());
  // Um identificador por registro: reenviar depois de uma falha de rede não pontua duas vezes.
  const [requestId, setRequestId] = useState(() => randomUUID());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const module = workoutModule(type);
  const draft: Draft = {
    type,
    durationMin: minutes,
    intensity,
    performedAt,
    // Distância em tudo menos na força; séries e carga, só nela.
    distanceM: module === 'forca' ? null : distanceM,
    setsCount: module === 'forca' ? setsCount : null,
    loadKg: module === 'forca' ? loadKg : null,
    note: module === 'outro' ? note.trim() : '',
    avgHeartRate: healthConsent ? avgHeartRate : null,
  };

  /* Aviso, nunca bloqueio: quem registra sabe o que fez. Serve para o dedo que escorregou no
     seletor, não para discutir o treino de ninguém. */
  const warnings = workoutWarnings({
    type: draft.type,
    durationMin: draft.durationMin,
    intensity: draft.intensity,
    distanceM: draft.distanceM,
    avgHeartRate: draft.avgHeartRate,
  });

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
        logged = await logWorkout({
          requestId,
          type,
          durationMin: minutes,
          intensity,
          performedAt: at ?? undefined,
          ...(draft.distanceM === null ? {} : { distanceM: draft.distanceM }),
          ...(draft.setsCount === null ? {} : { setsCount: draft.setsCount }),
          ...(draft.loadKg === null ? {} : { loadKg: draft.loadKg }),
          ...(draft.note === '' ? {} : { note: draft.note }),
          ...(draft.avgHeartRate === null ? {} : { avgHeartRate: draft.avgHeartRate }),
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.network)) throw error;
        // Sem conexão: guarda com o horário real do treino e envia depois com o mesmo identificador.
        const queuedAt = at ?? new Date();
        await queue.add({
          requestId,
          type,
          durationMin: minutes,
          intensity,
          performedAt: queuedAt.toISOString(),
          ...(draft.distanceM === null ? {} : { distanceM: draft.distanceM }),
          ...(draft.setsCount === null ? {} : { setsCount: draft.setsCount }),
          ...(draft.loadKg === null ? {} : { loadKg: draft.loadKg }),
        });
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
                {repeating && progress.data?.lastWorkout ? 'Igual ao último treino' : 'Ajuste se precisar'}
              </AppText>
            </View>
            <View style={styles.stepper}>
              <NumberField
                label="Duração"
                value={minutes}
                onChange={(value) => change(() => setMinutes(value))}
                min={DURATION.min}
                max={DURATION.max}
                step={DURATION.step}
                format={(value) => `${value} min`}
                disabled={disabled}
              />
            </View>
          </View>

          <View style={styles.group}>
            <AppText variant="bodyMedium">Intensidade</AppText>
            <Segmented label="Intensidade" options={INTENSITIES} value={intensity} onChange={(id) => change(() => setIntensity(id))} disabled={disabled} />
          </View>

          {/* Distância não existe na força: ninguém percorre quilômetro levantando peso. */}
          {module === 'forca' ? null : (
          <DetailRow
            label="Distância"
            hint="Não muda a Glória; entra no seu histórico e nos recordes"
            value={distanceM}
            format={formatDistance}
            step={DISTANCE.step}
            min={DISTANCE.step}
            max={DISTANCE.max}
            start={5000}
            disabled={disabled}
            onChange={(value) => change(() => setDistanceM(value))}
          />
          )}

          {/* "Outro" não diz o que foi o treino; o campo livre diz, e fica só com a pessoa. */}
          {module === 'outro' ? (
            <View style={styles.group}>
              <TextField
                label="O que foi?"
                hint="Opcional. Ex.: futebol, pilates, escalada."
                value={note}
                onChangeText={(text) => change(() => setNote(text))}
                placeholder="futebol"
                maxLength={NOTE_MAX_LENGTH}
                autoCapitalize="sentences"
                editable={!disabled}
                returnKeyType="done"
              />
            </View>
          ) : null}

          {healthConsent ? (
            <DetailRow
              label="Frequência cardíaca média"
              hint="Dado de saúde: fica só com você, nunca vai para a Legião"
              value={avgHeartRate}
              format={(value) => `${value} bpm`}
              step={5}
              min={30}
              max={240}
              start={140}
              disabled={disabled}
              onChange={(value) => change(() => setAvgHeartRate(value))}
            />
          ) : null}

          {module === 'forca' ? (
            <>
              <DetailRow
                label="Séries"
                hint="Quantas séries no total"
                value={setsCount}
                format={(value) => `${value}`}
                step={SETS.step}
                min={SETS.min}
                max={SETS.max}
                start={4}
                disabled={disabled}
                onChange={(value) => change(() => setSetsCount(value))}
              />
              <DetailRow
                label="Carga principal"
                hint="Peso do exercício principal"
                value={loadKg}
                format={formatLoad}
                step={LOAD.step}
                min={LOAD.min}
                max={LOAD.max}
                start={20}
                decimals
                disabled={disabled}
                onChange={(value) => change(() => setLoadKg(value))}
              />
            </>
          ) : null}

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

          {warnings.map((warning) => (
            <Notice key={warning} message={warning} />
          ))}

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
  removeDetail: {
    alignSelf: 'flex-end',
    minHeight: touchTarget - 16,
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
