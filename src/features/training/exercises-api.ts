import { isNonEmptyText, isRow, parseList } from '@/lib/parse';
import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

/**
 * Catálogo de exercícios: lista do app (mesma para todo mundo) mais os exercícios que a própria
 * pessoa criou. A separação vem do servidor — o `owner_id` nunca é enviado pelo app, e a política
 * de RLS já esconde o exercício personalizado de qualquer outra conta.
 */
export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  /** Criado pela própria pessoa (não faz parte do catálogo do app). */
  isCustom: boolean;
};

export type Labelled = { id: string; label: string };

export type ExerciseCatalog = {
  exercises: Exercise[];
  muscleGroups: Labelled[];
  equipment: Labelled[];
};

function parseExercise(item: unknown): Exercise | null {
  if (!isRow(item)) return null;
  const { id, name, muscle_group: muscleGroup, equipment, owner_id: ownerId } = item;
  if (!isNonEmptyText(id, 60) || !isNonEmptyText(name, 60)) return null;
  if (!isNonEmptyText(muscleGroup, 20) || !isNonEmptyText(equipment, 20)) return null;
  return { id, name, muscleGroup, equipment, isCustom: typeof ownerId === 'string' };
}

function parseLabelled(item: unknown): Labelled | null {
  if (!isRow(item)) return null;
  const { id, label } = item;
  return isNonEmptyText(id, 20) && isNonEmptyText(label, 40) ? { id, label } : null;
}

export async function fetchExerciseCatalog(): Promise<ExerciseCatalog> {
  const supabase = getSupabase();
  const [exercises, groups, equipment] = await Promise.all([
    supabase.from('exercises').select('id, name, muscle_group, equipment, owner_id').eq('is_active', true),
    supabase.from('muscle_groups').select('id, label').order('sort_order'),
    supabase.from('equipment').select('id, label').order('sort_order'),
  ]);

  const failure = exercises.error ?? groups.error ?? equipment.error;
  if (failure) throw toApiError(failure);

  const parsed = {
    exercises: parseList(exercises.data, parseExercise),
    muscleGroups: parseList(groups.data, parseLabelled),
    equipment: parseList(equipment.data, parseLabelled),
  };
  if (!parsed.exercises || !parsed.muscleGroups || !parsed.equipment) throw unexpectedResponse();

  // Os personalizados primeiro, depois o catálogo em ordem alfabética.
  parsed.exercises.sort((a, b) =>
    a.isCustom === b.isCustom ? a.name.localeCompare(b.name, 'pt-BR') : a.isCustom ? -1 : 1,
  );
  return parsed as ExerciseCatalog;
}

export async function createExercise(name: string, muscleGroup: string, equipment: string): Promise<Exercise> {
  const { data, error } = await getSupabase().rpc('create_exercise', {
    p_name: name,
    p_muscle_group: muscleGroup,
    p_equipment: equipment,
  });
  if (error) throw toApiError(error);
  const exercise = parseExercise(data);
  if (!exercise) throw unexpectedResponse();
  return exercise;
}

/** Busca sem acento e sem caixa: "triceps" acha "Tríceps". */
export function searchExercises(exercises: readonly Exercise[], term: string): Exercise[] {
  const needle = normalizeSearch(term);
  if (needle.length === 0) return [...exercises];
  return exercises.filter((exercise) => normalizeSearch(exercise.name).includes(needle));
}

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}
