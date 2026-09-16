import { isNonEmptyText, isNonNegativeInteger, isRow, isUuid, parseList } from '@/lib/parse';
import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

/**
 * Fichas de treino. A leitura vem direto das tabelas (a política de RLS já limita ao dono); a
 * escrita passa pela RPC, que confere item a item e grava a ficha inteira de uma vez.
 */
export type RoutineItem = {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetLoadKg: number | null;
  restSeconds: number | null;
};

export type Routine = {
  id: string;
  name: string;
  items: RoutineItem[];
};

/** Limites iguais aos do banco; a validação que vale é a de lá. */
export const ROUTINE_LIMITS = {
  maxRoutines: 20,
  maxItems: 30,
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  load: { min: 0.5, max: 500, step: 2.5 },
  rest: { min: 10, max: 600, step: 15 },
} as const;

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function parseItem(item: unknown): RoutineItem | null {
  if (!isRow(item)) return null;
  const { exercise_id: exerciseId, target_sets: sets, target_reps: reps } = item;
  if (!isNonEmptyText(exerciseId, 60) || !isNonNegativeInteger(sets) || !isNonNegativeInteger(reps)) return null;
  return {
    exerciseId,
    targetSets: sets,
    targetReps: reps,
    targetLoadKg: parseNumber(item.target_load_kg),
    restSeconds: parseNumber(item.rest_seconds),
  };
}

function parseRoutine(row: unknown): Routine | null {
  if (!isRow(row)) return null;
  const { id, name } = row;
  if (!isUuid(id) || !isNonEmptyText(name, 40)) return null;

  const rows = Array.isArray(row.routine_exercises) ? row.routine_exercises : [];
  const ordered = [...rows].sort((a, b) => {
    const left = isRow(a) && typeof a.position === 'number' ? a.position : 0;
    const right = isRow(b) && typeof b.position === 'number' ? b.position : 0;
    return left - right;
  });
  const items = parseList(ordered, parseItem);
  return items ? { id, name, items } : null;
}

export async function fetchMyRoutines(): Promise<Routine[]> {
  const { data, error } = await getSupabase()
    .from('routines')
    .select('id, name, position, routine_exercises(position, exercise_id, target_sets, target_reps, target_load_kg, rest_seconds)')
    .order('position');
  if (error) throw toApiError(error);
  const routines = parseList(data, parseRoutine);
  if (!routines) throw unexpectedResponse();
  return routines;
}

export async function saveRoutine(routineId: string | null, name: string, items: readonly RoutineItem[]): Promise<Routine> {
  const { data, error } = await getSupabase().rpc('save_routine', {
    // O tipo gerado marca o parâmetro como obrigatório, mas o banco aceita nulo (ficha nova).
    p_routine_id: routineId as unknown as string,
    p_name: name,
    p_items: items.map((item) => ({
      exercise_id: item.exerciseId,
      target_sets: item.targetSets,
      target_reps: item.targetReps,
      target_load_kg: item.targetLoadKg,
      rest_seconds: item.restSeconds,
    })),
  });
  if (error) throw toApiError(error);
  const row = isRow(data) ? data : null;
  if (!row || !isUuid(row.id) || !isNonEmptyText(row.name, 40)) throw unexpectedResponse();
  return { id: row.id, name: row.name, items: [...items] };
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_routine', { p_routine_id: routineId });
  if (error) throw toApiError(error);
}
