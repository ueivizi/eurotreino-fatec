import { isNonNegativeInteger, isRow, optionalNumber, parseList } from '@/lib/parse';
import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import { MODULES, isWorkoutTypeId, type ModuleId, type WorkoutTypeId } from './workout-types';

/**
 * Recordes pessoais por modalidade. A RPC devolve só os treinos de quem chama — não existe recorde
 * de outra pessoa nesta tela, nem na Legião. Como sempre, o que vem do servidor é conferido aqui:
 * os tipos gerados marcam como obrigatório campo que pode vir nulo.
 */
export type ModalityRecord = {
  type: WorkoutTypeId;
  module: ModuleId;
  workoutsCount: number;
  totalMinutes: number;
  /** Só modalidades de resistência; `null` quando ninguém informou distância. */
  bestDistanceM: number | null;
  totalDistanceM: number;
  /** Segundos por quilômetro do melhor treino de 1 km ou mais. */
  bestPaceSecondsPerKm: number | null;
  bestLoadKg: number | null;
  bestSetsCount: number | null;
};

function parseRecord(item: unknown): ModalityRecord | null {
  if (!isRow(item)) return null;
  const { workout_type: type, module, workouts_count: workoutsCount, total_minutes: totalMinutes } = item;
  if (!isWorkoutTypeId(type) || typeof module !== 'string' || !MODULES.includes(module as ModuleId)) return null;
  if (!isNonNegativeInteger(workoutsCount) || !isNonNegativeInteger(totalMinutes)) return null;

  const bestDistanceM = optionalNumber(item.best_distance_m);
  const totalDistanceM = optionalNumber(item.total_distance_m);
  const bestPaceSecondsPerKm = optionalNumber(item.best_pace_s_per_km);
  const bestLoadKg = optionalNumber(item.best_load_kg);
  const bestSetsCount = optionalNumber(item.best_sets_count);
  if ([bestDistanceM, totalDistanceM, bestPaceSecondsPerKm, bestLoadKg, bestSetsCount].includes(undefined)) return null;

  return {
    type,
    module: module as ModuleId,
    workoutsCount,
    totalMinutes,
    bestDistanceM: bestDistanceM ?? null,
    totalDistanceM: totalDistanceM ?? 0,
    bestPaceSecondsPerKm: bestPaceSecondsPerKm ?? null,
    bestLoadKg: bestLoadKg ?? null,
    bestSetsCount: bestSetsCount ?? null,
  };
}

export async function fetchMyRecords(): Promise<ModalityRecord[]> {
  const { data, error } = await getSupabase().rpc('my_records');
  if (error) throw toApiError(error);
  const records = parseList(data, parseRecord);
  if (!records) throw unexpectedResponse();
  return records;
}
