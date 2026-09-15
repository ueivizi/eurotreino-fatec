import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import type { IntensityId, WorkoutTypeId } from './workout-types';
import { parseLoggedWorkout, parseMyProgress, type LoggedWorkout, type MyProgress } from './workouts-parsers';

/** RF010: Glória acumulada e da semana, mais o último treino. */
export async function fetchMyProgress(): Promise<MyProgress> {
  const { data, error } = await getSupabase().rpc('my_progress');
  if (error) throw toApiError(error);
  const progress = parseMyProgress(data);
  if (!progress) throw unexpectedResponse();
  return progress;
}

export type WorkoutInput = {
  /** Gerado uma vez por registro; reenviar o mesmo valor nunca pontua duas vezes (NF007). */
  requestId: string;
  type: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  /** Quando o treino aconteceu (até 48 h antes). Sem valor, vale o relógio do servidor. */
  performedAt?: Date;
};

/** RF006/RF007: a Glória é calculada só no servidor. */
export async function logWorkout(input: WorkoutInput): Promise<LoggedWorkout> {
  const { data, error } = await getSupabase().rpc('log_workout', {
    p_client_request_id: input.requestId,
    p_workout_type: input.type,
    p_duration_min: input.durationMin,
    p_intensity: input.intensity,
    ...(input.performedAt ? { p_performed_at: input.performedAt.toISOString() } : {}),
  });
  if (error) throw toApiError(error);
  const logged = parseLoggedWorkout(data);
  if (!logged) throw unexpectedResponse();
  return logged;
}
