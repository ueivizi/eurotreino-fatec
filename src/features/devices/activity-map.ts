import type { WorkoutTypeId } from '@/features/workouts/workout-types';

/**
 * Tipos de exercício do Health Connect (ExerciseSessionRecord.exerciseType) agrupados nos tipos de
 * treino do EuroTreino. Os números são os da documentação do Android e das constantes da biblioteca;
 * o que não estiver aqui vira "outro", e a pessoa pode trocar antes de registrar.
 */
export const HEALTH_CONNECT_GROUPS: Record<Exclude<WorkoutTypeId, 'outro'>, readonly number[]> = {
  corrida: [56, 57], // RUNNING, RUNNING_TREADMILL
  caminhada: [79, 37], // WALKING, HIKING
  bike: [8, 9], // BIKING, BIKING_STATIONARY
  natacao: [73, 74], // SWIMMING_OPEN_WATER, SWIMMING_POOL
  // STRENGTH_TRAINING, WEIGHTLIFTING e os exercícios de musculação avulsos (supino, agachamento, remada…)
  musculacao: [70, 81, 1, 3, 6, 7, 15, 17, 18, 19, 20, 21, 22, 23, 24, 30, 42, 43, 67, 77],
  // CALISTHENICS, HIIT, BOOT_CAMP, BURPEE, JUMPING_JACK, JUMP_ROPE, PLANK, EXERCISE_CLASS, ELLIPTICAL,
  // STAIR_CLIMBING, STAIR_CLIMBING_MACHINE, ROWING_MACHINE
  funcional: [13, 36, 10, 12, 40, 41, 49, 26, 25, 68, 69, 54],
  // BADMINTON, BASEBALL, BASKETBALL, BOXING, CRICKET, FENCING, FOOTBALL (2), FRISBEE, GOLF, GYMNASTICS,
  // HANDBALL, ICE_HOCKEY, MARTIAL_ARTS, RACQUETBALL, ROLLER_HOCKEY, RUGBY, SOCCER, SOFTBALL, SQUASH,
  // TABLE_TENNIS, TENNIS, VOLLEYBALL, WATER_POLO
  esporte: [2, 4, 5, 11, 14, 27, 28, 29, 31, 32, 34, 35, 38, 44, 50, 52, 55, 64, 65, 66, 75, 76, 78, 80],
  yoga: [83, 48, 71, 33], // YOGA, PILATES, STRETCHING, GUIDED_BREATHING
};

const HEALTH_CONNECT_MAP = new Map<number, WorkoutTypeId>(
  Object.entries(HEALTH_CONNECT_GROUPS).flatMap(([type, codes]) => codes.map((code) => [code, type as WorkoutTypeId])),
);

export function workoutTypeFromHealthConnect(exerciseType: unknown): WorkoutTypeId {
  if (typeof exerciseType !== 'number' || !Number.isInteger(exerciseType)) return 'outro';
  return HEALTH_CONNECT_MAP.get(exerciseType) ?? 'outro';
}

/** Valor de <type> no GPX (Garmin Connect, Strava e Zepp exportam em inglês, com variações). */
export function workoutTypeFromGpx(value: string | null): WorkoutTypeId | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (/run|corrida|jog/.test(text)) return 'corrida';
  if (/walk|hik|caminhada|trilha/.test(text)) return 'caminhada';
  if (/cycl|bik|ride|ciclismo|pedal/.test(text)) return 'bike';
  if (/swim|nata/.test(text)) return 'natacao';
  return null;
}
