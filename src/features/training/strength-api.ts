import { isNonEmptyText, isNonNegativeInteger, isRow, parseList } from '@/lib/parse';
import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';
import { parseLoggedWorkout, type LoggedWorkout } from '@/features/workouts/workouts-parsers';

/**
 * Registro de treino de força e a Honra que ele rendeu. A Glória sai da mesma regra v1 de sempre —
 * carga e repetições não mudam ponto do Coliseu, só Honra e recorde pessoal.
 */
export type ExercisePersonalRecord = {
  exerciseId: string;
  kind: 'e1rm';
  previous: number;
  current: number;
};

export type HonorGain = {
  exerciseId: string;
  gained: number;
  points: number;
};

export type StrengthOutcome = {
  workout: LoggedWorkout;
  records: ExercisePersonalRecord[];
  honor: HonorGain[];
};

function parseNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function parseRecord(item: unknown): ExercisePersonalRecord | null {
  if (!isRow(item)) return null;
  const previous = parseNumber(item.previous);
  const current = parseNumber(item.current);
  if (!isNonEmptyText(item.exercise_id, 60) || item.kind !== 'e1rm') return null;
  if (previous === null || current === null) return null;
  return { exerciseId: item.exercise_id, kind: 'e1rm', previous, current };
}

function parseHonor(item: unknown): HonorGain | null {
  if (!isRow(item)) return null;
  const { exercise_id: exerciseId, gained, points } = item;
  if (!isNonEmptyText(exerciseId, 60) || !isNonNegativeInteger(gained) || !isNonNegativeInteger(points)) return null;
  return { exerciseId, gained, points };
}

export type StrengthInput = {
  requestId: string;
  workoutType: string;
  durationMin: number;
  intensity: string;
  sets: readonly { exercise_id: string; reps: number; load_kg: number | null }[];
  performedAt?: Date;
  routineId?: string | null;
};

export async function logStrengthWorkout(input: StrengthInput): Promise<StrengthOutcome> {
  const { data, error } = await getSupabase().rpc('log_strength_workout', {
    p_client_request_id: input.requestId,
    p_workout_type: input.workoutType,
    p_duration_min: input.durationMin,
    p_intensity: input.intensity,
    p_sets: input.sets as unknown as never,
    ...(input.performedAt ? { p_performed_at: input.performedAt.toISOString() } : {}),
    ...(input.routineId ? { p_routine_id: input.routineId } : {}),
  });
  if (error) throw toApiError(error);

  if (!isRow(data)) throw unexpectedResponse();
  const workout = parseLoggedWorkout([data.workout]);
  const records = parseList(data.records, parseRecord);
  const honor = parseList(data.honor, parseHonor);
  if (!workout || !records || !honor) throw unexpectedResponse();
  return { workout, records, honor };
}

/** Honra e recordes por exercício e por modalidade, só do próprio usuário. */
export type HonorEntry = {
  exerciseId: string | null;
  exerciseName: string | null;
  workoutType: string | null;
  points: number;
  levelId: number;
  levelName: string;
  nextLevelPoints: number | null;
  bestLoadKg: number | null;
  bestReps: number | null;
  bestE1rm: number | null;
};

function parseEntry(item: unknown): HonorEntry | null {
  if (!isRow(item)) return null;
  const { points, level_id: levelId, level_name: levelName } = item;
  if (!isNonNegativeInteger(points) || !isNonNegativeInteger(levelId) || !isNonEmptyText(levelName, 40)) return null;
  const exerciseId = typeof item.exercise_id === 'string' ? item.exercise_id : null;
  const workoutType = typeof item.workout_type === 'string' ? item.workout_type : null;
  if ((exerciseId === null) === (workoutType === null)) return null;
  return {
    exerciseId,
    exerciseName: typeof item.exercise_name === 'string' ? item.exercise_name : null,
    workoutType,
    points,
    levelId,
    levelName,
    nextLevelPoints: parseNumber(item.next_level_points),
    bestLoadKg: parseNumber(item.best_load_kg),
    bestReps: parseNumber(item.best_reps),
    bestE1rm: parseNumber(item.best_e1rm),
  };
}

export async function fetchMyHonor(): Promise<HonorEntry[]> {
  const { data, error } = await getSupabase().rpc('my_honor');
  if (error) throw toApiError(error);
  const entries = parseList(data, parseEntry);
  if (!entries) throw unexpectedResponse();
  return entries;
}
