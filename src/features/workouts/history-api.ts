import { isIsoDate, isNonNegativeInteger, isRow, isUuid, optionalNumber, parseList } from '@/lib/parse';
import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import { MODULES, isIntensityId, isWorkoutTypeId, type IntensityId, type ModuleId, type WorkoutTypeId } from './workout-types';

/**
 * Anais: o histórico de treinos da própria pessoa (RF012).
 *
 * Como sempre, o que volta do servidor é conferido aqui: os tipos gerados marcam como obrigatório
 * campo que pode vir nulo, e um treino malformado não pode derrubar a tela inteira -- por isso a
 * lista descarta o item que não passa, em vez de recusar o mês todo.
 */

export type HistoryMonth = {
  /** Primeiro dia do mês (ISO, só data). */
  month: string;
  workoutsCount: number;
  glory: number;
};

export type HistoryWorkout = {
  id: string;
  type: WorkoutTypeId;
  module: ModuleId;
  durationMin: number;
  intensity: IntensityId;
  performedAt: Date;
  isScored: boolean;
  /** Composição da Glória, para o detalhe explicar de onde veio cada ponto. */
  presence: number;
  duration: number;
  intensityPoints: number;
  bonus: number;
  points: number;
  distanceM: number | null;
  setsCount: number | null;
  loadKg: number | null;
  avgHeartRate: number | null;
  note: string | null;
  /** Se ainda está na semana corrente, a única que `edit_workout` aceita corrigir (RF014). */
  canEdit: boolean;
};

function parseMonth(value: unknown): HistoryMonth | null {
  if (!isRow(value)) return null;
  const { month, workouts_count: count, glory } = value;
  if (!isIsoDate(month) || !isNonNegativeInteger(count) || !isNonNegativeInteger(glory)) return null;
  return { month, workoutsCount: count, glory };
}

function parseWorkout(value: unknown): HistoryWorkout | null {
  if (!isRow(value)) return null;
  const { workout_id: id, workout_type: type, module, intensity } = value;
  if (!isUuid(id) || !isWorkoutTypeId(type) || !isIntensityId(intensity)) return null;
  if (typeof module !== 'string' || !MODULES.includes(module as ModuleId)) return null;

  const { duration_min: durationMin, performed_at: performedAt, is_scored: isScored, points, can_edit: canEdit } = value;
  if (!isNonNegativeInteger(durationMin) || typeof performedAt !== 'string') return null;
  const at = new Date(performedAt);
  if (Number.isNaN(at.getTime())) return null;
  if (typeof isScored !== 'boolean' || !isNonNegativeInteger(points) || typeof canEdit !== 'boolean') return null;

  const parts = [value.presence_points, value.duration_points, value.intensity_points, value.bonus_points];
  if (!parts.every(isNonNegativeInteger)) return null;

  const distanceM = optionalNumber(value.distance_m);
  const setsCount = optionalNumber(value.sets_count);
  const loadKg = optionalNumber(value.load_kg);
  const avgHeartRate = optionalNumber(value.avg_heart_rate);
  if ([distanceM, setsCount, loadKg, avgHeartRate].includes(undefined)) return null;

  const note = typeof value.note === 'string' && value.note.length > 0 && value.note.length <= 40 ? value.note : null;

  return {
    id,
    type,
    module: module as ModuleId,
    durationMin,
    intensity,
    performedAt: at,
    isScored,
    presence: parts[0] as number,
    duration: parts[1] as number,
    intensityPoints: parts[2] as number,
    bonus: parts[3] as number,
    points,
    distanceM: distanceM ?? null,
    setsCount: setsCount ?? null,
    loadKg: loadKg ?? null,
    avgHeartRate: avgHeartRate ?? null,
    note,
    canEdit,
  };
}

export function parseHistoryMonths(value: unknown): HistoryMonth[] | null {
  return parseList(value, parseMonth);
}

/** Um treino corrompido some da lista; o mês continua aparecendo. */
export function parseHistoryWorkouts(value: unknown): HistoryWorkout[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(parseWorkout).filter((workout): workout is HistoryWorkout => workout !== null);
}

export type EditWorkoutInput = {
  id: string;
  type: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  distanceM?: number;
  setsCount?: number;
  loadKg?: number;
  avgHeartRate?: number;
  note?: string;
};

/**
 * Corrige um treino da semana corrente (RF014). O servidor recusa semana fechada, detalhe fora da
 * família e medida sem consentimento — as mesmas regras do registro.
 */
export async function editWorkout(input: EditWorkoutInput): Promise<void> {
  const { error } = await getSupabase().rpc('edit_workout', {
    p_workout_id: input.id,
    p_workout_type: input.type,
    p_duration_min: input.durationMin,
    p_intensity: input.intensity,
    ...(input.distanceM === undefined ? {} : { p_distance_m: input.distanceM }),
    ...(input.setsCount === undefined ? {} : { p_sets_count: input.setsCount }),
    ...(input.loadKg === undefined ? {} : { p_load_kg: input.loadKg }),
    ...(input.avgHeartRate === undefined ? {} : { p_avg_heart_rate: input.avgHeartRate }),
    ...(input.note === undefined ? {} : { p_note: input.note }),
  });
  if (error) throw toApiError(error);
}

export async function fetchHistoryMonths(): Promise<HistoryMonth[]> {
  const { data, error } = await getSupabase().rpc('my_workout_months');
  if (error) throw toApiError(error);
  const months = parseHistoryMonths(data);
  if (!months) throw unexpectedResponse();
  return months;
}

/** `month` é o primeiro dia do mês (ISO); sem ele, o servidor devolve o mês corrente. */
export async function fetchHistoryWorkouts(month: string | null): Promise<HistoryWorkout[]> {
  const { data, error } = await getSupabase().rpc('my_workouts', month ? { p_month: month } : {});
  if (error) throw toApiError(error);
  const workouts = parseHistoryWorkouts(data);
  if (!workouts) throw unexpectedResponse();
  return workouts;
}
