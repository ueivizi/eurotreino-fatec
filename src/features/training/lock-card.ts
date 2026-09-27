import { workoutModule, workoutTypeLabel } from '@/features/workouts/workout-types';

import {
  addLap,
  canAddSet,
  elapsedMs,
  focusForItem,
  markFocusedSet,
  pauseSession,
  resumeSession,
  setFocus,
  setsOf,
  type Session,
} from './session';

/**
 * Cartão da tela bloqueada (Android): o que ele mostra e o que os botões dele fazem.
 *
 * O cartão é nativo e funciona com o app fechado: o relógio corre sozinho e cada toque é aplicado
 * ali mesmo e guardado numa fila. Quando o app volta, ele lê a fila e aplica na sessão com as
 * mesmas regras da tela — série além da meta não entra, e fechar a meta passa ao próximo exercício.
 */
export type CardExercise = {
  id: string;
  name: string;
  /** 0 quando o exercício não tem meta (avulso). */
  targetSets: number;
  done: number;
  reps: number;
  /** 0 quando é peso livre. */
  loadKg: number;
};

export type CardState = {
  kind: 'forca' | 'resistencia' | 'outro';
  title: string;
  elapsedMs: number;
  paused: boolean;
  exercises: CardExercise[];
  index: number;
  laps: number;
};

/** O cartão a partir da sessão: o exercício da vez com os números que a pessoa está usando. */
export function cardState(session: Session, now: Date): CardState {
  const focusId = session.focus?.exerciseId ?? null;
  const exercises = session.plan.map((item): CardExercise => {
    const values = item.exerciseId === focusId && session.focus ? session.focus : focusForItem(session, item);
    return {
      id: item.exerciseId,
      name: item.name,
      targetSets: item.targetSets ?? 0,
      done: setsOf(session, item.exerciseId).length,
      reps: values.reps,
      loadKg: values.loadKg ?? 0,
    };
  });
  const index = Math.max(0, exercises.findIndex((exercise) => exercise.id === focusId));
  return {
    kind: workoutModule(session.workoutType),
    title: session.routineName ?? workoutTypeLabel(session.workoutType),
    elapsedMs: elapsedMs(session, now),
    paused: session.pausedAt !== null,
    exercises,
    index,
    laps: session.laps.length,
  };
}

export type CardEvent =
  | { t: 'set'; id: string; reps: number; load: number; at: number }
  | { t: 'focus'; id: string }
  | { t: 'load'; id: string; load: number }
  | { t: 'pause'; at: number }
  | { t: 'resume'; at: number }
  | { t: 'lap'; at: number };

const MAX_EVENTS = 500;

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 60;
}

function isInstant(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isLoad(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 500;
}

/** A fila vem do lado nativo: é lida como dado de fora, e o que não bate é descartado. */
export function parseCardEvents(raw: string | null): CardEvent[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const events: CardEvent[] = [];
  for (const item of data.slice(0, MAX_EVENTS)) {
    if (typeof item !== 'object' || item === null) continue;
    const event = item as Record<string, unknown>;
    if (event.t === 'set' && isId(event.id) && isInstant(event.at) && isLoad(event.load)) {
      const reps = event.reps;
      if (typeof reps === 'number' && Number.isInteger(reps) && reps >= 1 && reps <= 200) {
        events.push({ t: 'set', id: event.id, reps, load: event.load, at: event.at });
      }
    } else if (event.t === 'focus' && isId(event.id)) {
      events.push({ t: 'focus', id: event.id });
    } else if (event.t === 'load' && isId(event.id) && isLoad(event.load)) {
      events.push({ t: 'load', id: event.id, load: event.load });
    } else if ((event.t === 'pause' || event.t === 'resume' || event.t === 'lap') && isInstant(event.at)) {
      events.push({ t: event.t, at: event.at });
    }
  }
  return events;
}

/** Instante do toque, sem deixar um relógio adiantado criar tempo no futuro. */
function when(at: number, now: Date): Date {
  return new Date(Math.min(at, now.getTime()));
}

/** Aplica os toques do cartão na sessão, na ordem, com as regras da tela. */
export function applyCardEvents(session: Session, events: readonly CardEvent[], now: Date): Session {
  let next = session;
  for (const event of events) {
    if (event.t === 'set') {
      const item = next.plan.find((entry) => entry.exerciseId === event.id);
      if (!item || !canAddSet(next, event.id)) continue;
      // A série vale com os números que o cartão mostrava no toque.
      next = setFocus(next, { exerciseId: item.exerciseId, exerciseName: item.name, reps: event.reps, loadKg: event.load > 0 ? event.load : null });
      next = markFocusedSet(next, when(event.at, now)).session;
    } else if (event.t === 'focus') {
      const item = next.plan.find((entry) => entry.exerciseId === event.id);
      if (item && next.focus?.exerciseId !== item.exerciseId) next = setFocus(next, focusForItem(next, item));
    } else if (event.t === 'load') {
      if (next.focus?.exerciseId === event.id) next = setFocus(next, { ...next.focus, loadKg: event.load > 0 ? event.load : null });
    } else if (event.t === 'pause') {
      next = pauseSession(next, when(event.at, now));
    } else if (event.t === 'resume') {
      next = resumeSession(next, when(event.at, now));
    } else {
      next = addLap(next, when(event.at, now));
    }
  }
  return next;
}
