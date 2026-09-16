import { isIsoDate, isNonNegativeInteger, isUuid, singleRow } from '@/lib/parse';

import { DURATION, isIntensityId, isWorkoutTypeId, type IntensityId, type WorkoutTypeId } from './workout-types';

export type LastWorkout = { type: WorkoutTypeId; durationMin: number; intensity: IntensityId };

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
      lastWorkout = { type, durationMin, intensity };
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
