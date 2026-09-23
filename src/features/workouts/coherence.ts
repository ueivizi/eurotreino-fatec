import { speedKmPerHour } from './metrics';
import { workoutTypeLabel, type IntensityId, type WorkoutTypeId } from './workout-types';

/**
 * Avisos de coerência entre o que a pessoa informou: frequência cardíaca, intensidade e distância.
 *
 * São **avisos, nunca bloqueios**. Quem registra sabe o que fez: dá para correr 30 km/h num tiro
 * curto e dá para terminar um treino intenso com a frequência baixa. O que não dá é o app deixar
 * passar em silêncio um 300 km/h de bicicleta que veio de um dedo escorregando no seletor.
 *
 * Nada disto muda a Glória: a regra v1 continua sendo presença, duração, intensidade e constância.
 */

export type WorkoutFacts = {
  type: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  distanceM: number | null;
  avgHeartRate: number | null;
};

/** Acima disto, a frequência média não combina com "leve"; abaixo, não combina com "intenso". */
const HEART_RATE = { highForLight: 160, lowForHard: 110 } as const;

/**
 * Teto de velocidade média por modalidade, em km/h, com folga de sobra para quem é rápido:
 * recorde mundial de maratona anda a ~21 km/h, e uma bicicleta de estrada em grupo, a ~45.
 */
const TOP_SPEED: Partial<Record<WorkoutTypeId, number>> = {
  corrida: 28,
  caminhada: 10,
  bike: 70,
  natacao: 8,
};

/** Piso só onde a modalidade se confunde com outra mais lenta. */
const LOW_SPEED: Partial<Record<WorkoutTypeId, { limit: number; instead: WorkoutTypeId }>> = {
  corrida: { limit: 5, instead: 'caminhada' },
  bike: { limit: 8, instead: 'caminhada' },
};

function formatSpeed(kmPerHour: number): string {
  return `${kmPerHour.toFixed(1).replace('.', ',')} km/h`;
}

export function workoutWarnings(facts: WorkoutFacts): string[] {
  const warnings: string[] = [];
  const { type, durationMin, intensity, distanceM, avgHeartRate } = facts;

  if (avgHeartRate !== null) {
    if (intensity === 'leve' && avgHeartRate >= HEART_RATE.highForLight) {
      warnings.push(`${avgHeartRate} bpm de média é bastante para um treino leve. Confira a intensidade.`);
    }
    if (intensity === 'intenso' && avgHeartRate <= HEART_RATE.lowForHard) {
      warnings.push(`${avgHeartRate} bpm de média é pouco para um treino intenso. Confira a intensidade.`);
    }
  }

  if (distanceM !== null && durationMin > 0) {
    const speed = speedKmPerHour(distanceM, durationMin);
    const top = TOP_SPEED[type];
    const low = LOW_SPEED[type];
    if (speed !== null && top !== undefined && speed > top) {
      warnings.push(`Dá ${formatSpeed(speed)} de média, acima do esperado para ${workoutTypeLabel(type).toLowerCase()}. Confira a distância e a duração.`);
    }
    if (speed !== null && low !== undefined && speed < low.limit) {
      warnings.push(`Dá ${formatSpeed(speed)} de média. Se foi ${workoutTypeLabel(low.instead).toLowerCase()}, troque a modalidade.`);
    }
  }

  return warnings;
}
