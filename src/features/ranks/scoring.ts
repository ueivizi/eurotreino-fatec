/**
 * Regra de pontuação v1, só para explicar a Glória na tela: quem calcula é o servidor
 * (`private.workout_points_v1` e `private.log_workout_for`). O teste de sincronia do banco
 * (`npm run test:db`) compara `workoutPoints` com a função do Postgres.
 */

import type { IntensityId } from '@/features/workouts/workout-types';

export const SCORING = {
  presence: 10,
  /** +1 a cada 10 minutos, até +6. */
  minutesPerPoint: 10,
  maxDurationPoints: 6,
  intensity: { leve: 0, moderado: 2, intenso: 4 } satisfies Record<IntensityId, number>,
  /** Bônus no 3º treino pontuado da semana. */
  weeklyBonus: 10,
  weeklyBonusAt: 3,
  maxScoredPerDay: 2,
  lateLogHours: 48,
} as const;

export type WorkoutPoints = { presence: number; duration: number; intensity: number };

export function workoutPoints(durationMin: number, intensity: IntensityId): WorkoutPoints {
  if (!Number.isInteger(durationMin) || durationMin < 0) {
    throw new RangeError('A duração deve ser um número inteiro não negativo.');
  }
  return {
    presence: SCORING.presence,
    duration: Math.min(Math.floor(durationMin / SCORING.minutesPerPoint), SCORING.maxDurationPoints),
    intensity: SCORING.intensity[intensity],
  };
}
