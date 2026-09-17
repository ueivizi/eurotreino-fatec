import { isWorkoutTypeId } from '@/features/workouts/workout-types';
import { isRow } from '@/lib/parse';
import { toApiError } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import type { RecentWorkout } from './imported-workout';

/**
 * Treinos da própria pessoa desde `since`, para avisar quando um importado parece já ter sido registrado
 * à mão. A política de leitura só devolve os treinos de quem pergunta.
 */
export async function fetchRecentWorkouts(since: Date): Promise<RecentWorkout[]> {
  const { data, error } = await getSupabase()
    .from('workouts')
    .select('workout_type, performed_at, duration_min')
    .gte('performed_at', since.toISOString())
    .order('performed_at', { ascending: false })
    .limit(100);
  if (error) throw toApiError(error);
  const rows: unknown[] = Array.isArray(data) ? data : [];
  return rows.flatMap((row) => {
    if (!isRow(row) || !isWorkoutTypeId(row.workout_type) || typeof row.performed_at !== 'string') return [];
    const performedAt = Date.parse(row.performed_at);
    const durationMin = typeof row.duration_min === 'number' ? row.duration_min : Number.NaN;
    if (Number.isNaN(performedAt) || !Number.isInteger(durationMin)) return [];
    return [{ type: row.workout_type, performedAt: new Date(performedAt), durationMin }];
  });
}
