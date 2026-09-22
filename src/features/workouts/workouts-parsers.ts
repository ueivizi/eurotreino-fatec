import { isIsoDate, isNonEmptyText, isNonNegativeInteger, isUuid, optionalNumber, singleRow } from '@/lib/parse';

import {
  DISTANCE,
  DURATION,
  LOAD,
  NOTE_MAX_LENGTH,
  SETS,
  isIntensityId,
  isWorkoutTypeId,
  type IntensityId,
  type WorkoutTypeId,
} from './workout-types';

/**
 * O último treino, para "Repetir último" recomeçar do mesmo lugar. Os detalhes vêm da família da
 * modalidade: distância na resistência, séries e carga na força. Frequência cardíaca não vem, e é
 * de propósito — medida não se repete (ver a migração 20260922120000).
 */
export type LastWorkout = {
  type: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  distanceM: number | null;
  setsCount: number | null;
  loadKg: number | null;
  /** O que foi o treino, quando a modalidade é da família "outro". */
  note: string | null;
};

/**
 * Detalhe fora dos limites do app é descartado, não derruba a resposta: prefere-se o campo vazio
 * (a pessoa digita) a uma tela de progresso em branco por causa de um valor que não serve.
 */
function detailInRange(value: unknown, limits: { min: number; max: number }): number | null {
  const parsed = optionalNumber(value);
  if (typeof parsed !== 'number') return null;
  return parsed >= limits.min && parsed <= limits.max ? parsed : null;
}

export type MyProgress = {
  totalGlory: number;
  weekGlory: number;
  weekStart: string;
  weekScoredWorkouts: number;
  /** Treinos registrados desde o início, pontuados ou não. */
  totalWorkouts: number;
  /** `null` para quem ainda não registrou treino. */
  lastWorkout: LastWorkout | null;
};

export type LoggedWorkout = {
  workoutId: string;
  presence: number;
  duration: number;
  intensity: number;
  bonus: number;
  points: number;
  isScored: boolean;
  weekGlory: number;
  totalGlory: number;
  replayed: boolean;
  /** Distância maior que todas as anteriores desta modalidade. */
  isDistanceRecord: boolean;
};

export function parseMyProgress(value: unknown): MyProgress | null {
  const row = singleRow(value);
  if (!row) return null;
  const { total_glory: totalGlory, week_glory: weekGlory, week_start: weekStart } = row;
  const { week_scored_workouts: weekScoredWorkouts, total_workouts: totalWorkouts } = row;
  if (!isNonNegativeInteger(totalGlory) || !isNonNegativeInteger(weekGlory) || !isIsoDate(weekStart)) return null;
  if (!isNonNegativeInteger(weekScoredWorkouts) || !isNonNegativeInteger(totalWorkouts)) return null;

  const { last_workout_type: type, last_duration_min: durationMin, last_intensity: intensity } = row;
  let lastWorkout: LastWorkout | null = null;
  if (type !== null || durationMin !== null || intensity !== null) {
    const durationOk = isNonNegativeInteger(durationMin) && durationMin >= DURATION.min && durationMin <= DURATION.max;
    // Tipo desativado ou desconhecido não impede a tela: só não sugere "Repetir último".
    if (isWorkoutTypeId(type) && durationOk && isIntensityId(intensity)) {
      lastWorkout = {
        type,
        durationMin,
        intensity,
        distanceM: detailInRange(row.last_distance_m, DISTANCE),
        setsCount: detailInRange(row.last_sets_count, SETS),
        loadKg: detailInRange(row.last_load_kg, LOAD),
        note: isNonEmptyText(row.last_note, NOTE_MAX_LENGTH) ? row.last_note : null,
      };
    } else if (!(typeof type === 'string' && durationOk && isIntensityId(intensity))) {
      return null;
    }
  }

  return { totalGlory, weekGlory, weekStart, weekScoredWorkouts, totalWorkouts, lastWorkout };
}

export function parseLoggedWorkout(value: unknown): LoggedWorkout | null {
  const row = singleRow(value);
  if (!row) return null;
  const {
    workout_id: workoutId,
    presence_points: presence,
    duration_points: duration,
    intensity_points: intensity,
    bonus_points: bonus,
    points,
    is_scored: isScored,
    week_glory: weekGlory,
    total_glory: totalGlory,
    replayed,
    is_distance_record: isDistanceRecord,
  } = row;

  if (!isUuid(workoutId) || typeof isScored !== 'boolean' || typeof replayed !== 'boolean') return null;
  if (typeof isDistanceRecord !== 'boolean') return null;
  const numbers = [presence, duration, intensity, bonus, points, weekGlory, totalGlory];
  if (!numbers.every(isNonNegativeInteger)) return null;
  const [p, d, i, b, total, week, overall] = numbers as number[];
  if (p + d + i + b !== total || total > overall) return null;

  return {
    workoutId,
    presence: p,
    duration: d,
    intensity: i,
    bonus: b,
    points: total,
    isScored,
    weekGlory: week,
    totalGlory: overall,
    replayed,
    isDistanceRecord,
  };
}
