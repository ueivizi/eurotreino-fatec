import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import { LATE_LOG_WINDOW_MS } from '@/features/workouts/performed-at';
import { DISTANCE, DURATION, workoutModule, type IntensityId, type WorkoutTypeId } from '@/features/workouts/workout-types';
import type { WorkoutInput } from '@/features/workouts/workouts-api';

/**
 * Treino lido de fora (Health Connect ou arquivo GPX), já normalizado. Tudo aqui veio de outro app ou
 * de um arquivo escolhido pela pessoa: é dado externo, validado antes de virar registro. A Glória
 * continua sendo calculada só no servidor, com a mesma regra de qualquer outro treino.
 */
export type ImportSource = 'health-connect' | 'gpx';

export type ImportedWorkout = {
  source: ImportSource;
  /** Identificador do registro na origem (id do Health Connect ou impressão digital do arquivo). */
  sourceId: string;
  /** App que gravou o treino (ex.: pacote do Garmin Connect), quando a origem informa. */
  origin: string | null;
  /** Tipo sugerido pela origem; a pessoa confirma ou troca. */
  suggestedType: WorkoutTypeId | null;
  startedAt: Date;
  endedAt: Date;
  distanceM: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
};

/** O servidor só aceita treino até 48 h depois; a margem evita recusa por segundos de diferença. */
export const IMPORT_WINDOW_MS = LATE_LOG_WINDOW_MS - 5 * 60_000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;
const HEART_RATE = { min: 30, max: 240 } as const;

export type ImportEligibility = 'ok' | 'too_old' | 'too_short' | 'too_long' | 'in_future';

export const ELIGIBILITY_MESSAGES: Record<Exclude<ImportEligibility, 'ok'>, string> = {
  too_old: 'Passou de 48 horas: a regra da Arena não aceita mais o registro.',
  too_short: 'Durou menos de 1 minuto.',
  too_long: 'Durou mais de 5 horas, acima do limite de um registro.',
  in_future: 'O horário está no futuro. Confira o relógio do aparelho.',
};

export function durationMinutesOf(workout: Pick<ImportedWorkout, 'startedAt' | 'endedAt'>): number {
  return Math.round((workout.endedAt.getTime() - workout.startedAt.getTime()) / 60_000);
}

export function importEligibility(workout: ImportedWorkout, now: Date): ImportEligibility {
  if (workout.startedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return 'in_future';
  if (now.getTime() - workout.startedAt.getTime() > IMPORT_WINDOW_MS) return 'too_old';
  const minutes = durationMinutesOf(workout);
  if (minutes < DURATION.min) return 'too_short';
  if (minutes > DURATION.max) return 'too_long';
  return 'ok';
}

/**
 * Identificador do registro derivado da origem: importar o mesmo treino de novo devolve o registro
 * existente, sem pontuar duas vezes (NF007). Formato UUID (versão 8, conteúdo de SHA-256).
 */
export async function importRequestId(workout: Pick<ImportedWorkout, 'source' | 'origin' | 'sourceId'>): Promise<string> {
  const hex = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `eurotreino-import:${workout.source}:${workout.origin ?? ''}:${workout.sourceId}`);
  return uuidFromHex(hex);
}

export function uuidFromHex(hex: string): string {
  if (!/^[0-9a-f]{32,}$/i.test(hex)) throw new RangeError('hash inválido');
  const h = hex.slice(0, 32).toLowerCase().split('');
  h[12] = '8';
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function heartRate(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= HEART_RATE.min && rounded <= HEART_RATE.max ? rounded : null;
}

/**
 * Monta o registro. Distância só vai para modalidades de resistência (o servidor recusa o resto), e a
 * frequência cardíaca só vai com consentimento dado no perfil — sem ele, o dado nem sai do aparelho.
 */
export function toWorkoutInput(
  workout: ImportedWorkout,
  choice: { type: WorkoutTypeId; intensity: IntensityId; requestId: string; healthConsent: boolean },
): WorkoutInput {
  const input: WorkoutInput = {
    requestId: choice.requestId,
    type: choice.type,
    durationMin: Math.min(DURATION.max, Math.max(DURATION.min, durationMinutesOf(workout))),
    intensity: choice.intensity,
    performedAt: workout.startedAt,
  };

  if (workoutModule(choice.type) === 'resistencia' && workout.distanceM !== null && Number.isFinite(workout.distanceM)) {
    const meters = Math.round(workout.distanceM);
    if (meters >= DISTANCE.min && meters <= DISTANCE.max) input.distanceM = meters;
  }

  if (choice.healthConsent) {
    let avg = heartRate(workout.avgHeartRate);
    let max = heartRate(workout.maxHeartRate);
    if (avg !== null && max !== null && avg > max) {
      avg = null;
      max = null;
    }
    if (avg !== null) input.avgHeartRate = avg;
    if (max !== null) input.maxHeartRate = max;
  }
  return input;
}

/**
 * Treino do relógio que corresponde a uma sessão cronometrada no app: o que mais se sobrepõe ao
 * intervalo, desde que cubra ao menos metade dele. Sem correspondência clara, nada é preenchido.
 */
export function matchingWorkout(workouts: ImportedWorkout[], from: Date, to: Date): ImportedWorkout | null {
  const span = to.getTime() - from.getTime();
  if (span <= 0) return null;
  let best: ImportedWorkout | null = null;
  let bestOverlap = 0;
  for (const workout of workouts) {
    const overlap = Math.min(to.getTime(), workout.endedAt.getTime()) - Math.max(from.getTime(), workout.startedAt.getTime());
    if (overlap > bestOverlap) {
      best = workout;
      bestOverlap = overlap;
    }
  }
  return best !== null && bestOverlap >= span / 2 ? best : null;
}

export type RecentWorkout ={ type: WorkoutTypeId; performedAt: Date; durationMin: number };

/**
 * Treino do mesmo tipo registrado à mão perto do horário do importado: provavelmente é o mesmo treino.
 * O registro manual guarda o momento do envio, que costuma cair no fim do treino, daí a janela larga.
 */
export function likelyDuplicate(workout: ImportedWorkout, type: WorkoutTypeId, recent: RecentWorkout[]): boolean {
  const from = workout.startedAt.getTime() - 60 * 60_000;
  const to = workout.endedAt.getTime() + 3 * 3600_000;
  return recent.some((item) => item.type === type && item.performedAt.getTime() >= from && item.performedAt.getTime() <= to);
}
