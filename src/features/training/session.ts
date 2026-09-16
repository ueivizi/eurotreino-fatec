import { isNonEmptyText, isRow } from '@/lib/parse';

import { isIntensityId, isWorkoutTypeId, type IntensityId, type WorkoutTypeId } from '@/features/workouts/workout-types';

/**
 * Sessão de treino ao vivo.
 *
 * O cronômetro mora no aparelho, não no servidor: a pessoa tranca a tela, o app é fechado pelo
 * sistema, a bateria acaba — e a sessão continua de pé, porque o que fica guardado são instantes
 * (quando começou, quando pausou), não um contador correndo. Só o treino **terminado** vai para o
 * servidor, pela mesma RPC de sempre. Sessão aberta não existe no banco: é ela que vira treino
 * fantasma quando alguém esquece o app ligado.
 */

export type SessionSet = {
  exerciseId: string;
  reps: number;
  loadKg: number | null;
  /** Instante em que a série foi marcada (ISO 8601), só para o histórico da sessão. */
  doneAt: string;
};

export type Session = {
  userId: string;
  workoutType: WorkoutTypeId;
  /** Identificador do registro, criado junto com a sessão: reenviar nunca pontua duas vezes. */
  requestId: string;
  startedAt: string;
  /** Instante da pausa atual; nulo quando está correndo. */
  pausedAt: string | null;
  /** Tempo já acumulado antes da pausa atual, em milissegundos. */
  elapsedBeforePauseMs: number;
  routineId: string | null;
  sets: SessionSet[];
  /** Voltas marcadas na resistência: tempo decorrido, em ms, no momento de cada toque. */
  laps: number[];
};

export const SESSION_STORAGE_KEY = 'eurotreino.sessao';

/** Sessão mais longa que isto é esquecimento, não treino: o app oferece descartar. */
export const MAX_SESSION_HOURS = 6;

export function startSession(input: {
  userId: string;
  workoutType: WorkoutTypeId;
  requestId: string;
  routineId?: string | null;
  now?: Date;
}): Session {
  return {
    userId: input.userId,
    workoutType: input.workoutType,
    requestId: input.requestId,
    startedAt: (input.now ?? new Date()).toISOString(),
    pausedAt: null,
    elapsedBeforePauseMs: 0,
    routineId: input.routineId ?? null,
    sets: [],
    laps: [],
  };
}

export function elapsedMs(session: Session, now: Date): number {
  if (session.pausedAt) return session.elapsedBeforePauseMs;
  const running = now.getTime() - new Date(session.startedAt).getTime();
  // Relógio do aparelho ajustado para trás não pode virar tempo negativo na tela.
  return session.elapsedBeforePauseMs + Math.max(0, running);
}

export function pauseSession(session: Session, now: Date): Session {
  if (session.pausedAt) return session;
  return {
    ...session,
    pausedAt: now.toISOString(),
    elapsedBeforePauseMs: elapsedMs(session, now),
  };
}

export function resumeSession(session: Session, now: Date): Session {
  if (!session.pausedAt) return session;
  return { ...session, pausedAt: null, startedAt: now.toISOString() };
}

export function addSet(session: Session, set: Omit<SessionSet, 'doneAt'>, now: Date): Session {
  return { ...session, sets: [...session.sets, { ...set, doneAt: now.toISOString() }] };
}

export function removeLastSet(session: Session, exerciseId: string): Session {
  const index = session.sets.map((set) => set.exerciseId).lastIndexOf(exerciseId);
  if (index < 0) return session;
  return { ...session, sets: session.sets.filter((_, position) => position !== index) };
}

/** Marca uma volta com o tempo atual do cronômetro. Até 200: mais que isso é dedo nervoso. */
export function addLap(session: Session, now: Date): Session {
  if (session.laps.length >= 200) return session;
  return { ...session, laps: [...session.laps, elapsedMs(session, now)] };
}

export function removeLastLap(session: Session): Session {
  return session.laps.length === 0 ? session : { ...session, laps: session.laps.slice(0, -1) };
}

/** Duração de cada volta: a diferença entre uma marca e a anterior. */
export function lapDurations(session: Session): number[] {
  return session.laps.map((lap, index) => lap - (index === 0 ? 0 : session.laps[index - 1]));
}

export function setsOf(session: Session, exerciseId: string): SessionSet[] {
  return session.sets.filter((set) => set.exerciseId === exerciseId);
}

/** Duração em minutos para o registro: no mínimo 1, no máximo 300 (limite do servidor). */
export function durationMinutes(session: Session, now: Date): number {
  const minutes = Math.round(elapsedMs(session, now) / 60_000);
  return Math.min(300, Math.max(1, minutes));
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function isTooLong(session: Session, now: Date): boolean {
  return elapsedMs(session, now) > MAX_SESSION_HOURS * 3600_000;
}

function parseSet(value: unknown): SessionSet | null {
  if (!isRow(value)) return null;
  const { exerciseId, reps, loadKg, doneAt } = value;
  if (!isNonEmptyText(exerciseId, 60)) return null;
  if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 1 || reps > 200) return null;
  if (loadKg !== null && loadKg !== undefined) {
    if (typeof loadKg !== 'number' || !Number.isFinite(loadKg) || loadKg <= 0 || loadKg > 500) return null;
  }
  if (typeof doneAt !== 'string') return null;
  return { exerciseId, reps, loadKg: typeof loadKg === 'number' ? loadKg : null, doneAt };
}

/**
 * O que está guardado no aparelho é dado externo como qualquer outro: veio de uma versão antiga do
 * app, de uma edição manual ou de um arquivo corrompido. Fora do formato, a sessão é descartada.
 */
export function parseSession(raw: string | null): Session | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRow(value)) return null;

  const { userId, workoutType, requestId, startedAt, pausedAt, elapsedBeforePauseMs, routineId, sets } = value;
  if (!isNonEmptyText(userId, 36) || !isNonEmptyText(requestId, 36)) return null;
  if (typeof workoutType !== 'string' || !isWorkoutTypeId(workoutType)) return null;
  if (typeof startedAt !== 'string' || Number.isNaN(Date.parse(startedAt))) return null;
  if (pausedAt !== null && (typeof pausedAt !== 'string' || Number.isNaN(Date.parse(pausedAt)))) return null;
  if (typeof elapsedBeforePauseMs !== 'number' || !Number.isFinite(elapsedBeforePauseMs) || elapsedBeforePauseMs < 0) {
    return null;
  }
  if (!Array.isArray(sets)) return null;

  const laps = value.laps === undefined ? [] : value.laps;
  if (!Array.isArray(laps)) return null;
  // Volta é tempo decorrido: número finito, não negativo e em ordem crescente.
  const parsedLaps: number[] = [];
  for (const lap of laps) {
    if (typeof lap !== 'number' || !Number.isFinite(lap) || lap < 0) return null;
    if (parsedLaps.length > 0 && lap < parsedLaps[parsedLaps.length - 1]) return null;
    parsedLaps.push(lap);
  }

  const parsedSets: SessionSet[] = [];
  for (const item of sets) {
    const parsed = parseSet(item);
    if (!parsed) return null;
    parsedSets.push(parsed);
  }

  return {
    userId,
    workoutType,
    requestId,
    startedAt,
    pausedAt: typeof pausedAt === 'string' ? pausedAt : null,
    elapsedBeforePauseMs,
    routineId: typeof routineId === 'string' ? routineId : null,
    sets: parsedSets,
    laps: parsedLaps,
  };
}

export type FinishedSession = {
  requestId: string;
  workoutType: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  sets: { exercise_id: string; reps: number; load_kg: number | null }[];
  routineId: string | null;
};

export function finishSession(session: Session, intensity: string, now: Date): FinishedSession | null {
  if (!isIntensityId(intensity)) return null;
  return {
    requestId: session.requestId,
    workoutType: session.workoutType,
    durationMin: durationMinutes(session, now),
    intensity,
    sets: session.sets.map((set) => ({ exercise_id: set.exerciseId, reps: set.reps, load_kg: set.loadKg })),
    routineId: session.routineId,
  };
}
