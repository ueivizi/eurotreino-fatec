import type { IconName } from '@/components/ui/icon';
import { formatDistance, formatLoad, paceModality, performanceFor } from '@/features/workouts/metrics';
import { workoutFlavor } from '@/features/workouts/share-workout';
import {
  WORKOUT_TYPES,
  intensityLabel,
  workoutModule,
  workoutTypeLabel,
  type IntensityId,
  type WorkoutTypeId,
} from '@/features/workouts/workout-types';

/**
 * O que cada modalidade mostra na imagem de partilha.
 *
 * Musculação não tem ritmo, corrida não tem carga, bike se lê em velocidade e natação em ritmo:
 * uma imagem só para todas sairia com metade dos campos vazios. Aqui fica a escolha dos números —
 * o desenho da imagem é outra coisa, e vive no `ShareCard`.
 *
 * Nada que apareça aqui é de outra pessoa: sem nome de Legião, sem posição, sem quem ficou para
 * trás. O que vai para a imagem é o treino de quem está compartilhando.
 */

export type ShareStat = {
  label: string;
  value: string;
};

export type ShareLayout = {
  /** Título grande: a modalidade, ou o campo livre quando a pessoa escreveu um. */
  title: string;
  /** Até quatro números, na ordem em que a modalidade prefere ser lida. */
  stats: readonly ShareStat[];
  motto: string;
  mark: string;
  when: string;
  /** Ícone da modalidade, que vira marca d'água quando o cartão não tem foto. */
  icon: IconName;
};

export type ShareWorkout = {
  type: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  distanceM: number | null;
  setsCount: number | null;
  loadKg: number | null;
  points: number;
  isScored: boolean;
  note: string | null;
  performedAt: Date;
};

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function shareDate(date: Date): string {
  return `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

function duration(minutes: number): ShareStat {
  return { label: 'Tempo', value: `${minutes} min` };
}

/** Os números da família de resistência: distância na frente, porque é o que se pergunta. */
function enduranceStats(workout: ShareWorkout): ShareStat[] {
  const stats: ShareStat[] = [];
  if (workout.distanceM !== null) stats.push({ label: 'Distância', value: formatDistance(workout.distanceM) });
  stats.push(duration(workout.durationMin));
  const performance = workout.distanceM === null ? null : performanceFor(workout.type, workout.distanceM, workout.durationMin);
  if (performance) stats.push({ label: paceModality(workout.type) === 'velocidade' ? 'Velocidade' : 'Ritmo', value: performance });
  if (stats.length < 3) stats.push({ label: 'Intensidade', value: intensityLabel(workout.intensity) });
  return stats;
}

/** Na força o que conta é o volume: séries e a carga do exercício principal. */
function strengthStats(workout: ShareWorkout): ShareStat[] {
  const stats: ShareStat[] = [duration(workout.durationMin)];
  if (workout.setsCount !== null) stats.push({ label: 'Séries', value: String(workout.setsCount) });
  if (workout.loadKg !== null) stats.push({ label: 'Carga', value: formatLoad(workout.loadKg) });
  if (stats.length < 3) stats.push({ label: 'Intensidade', value: intensityLabel(workout.intensity) });
  return stats;
}

function otherStats(workout: ShareWorkout): ShareStat[] {
  const stats: ShareStat[] = [duration(workout.durationMin), { label: 'Intensidade', value: intensityLabel(workout.intensity) }];
  if (workout.distanceM !== null) stats.push({ label: 'Distância', value: formatDistance(workout.distanceM) });
  return stats;
}

export function shareLayout(workout: ShareWorkout): ShareLayout {
  const flavor = workoutFlavor(workout.type);
  const module = workoutModule(workout.type);
  const stats =
    module === 'resistencia' ? enduranceStats(workout) : module === 'forca' ? strengthStats(workout) : otherStats(workout);

  // A Glória fecha o quadro, e só quando o treino pontuou: "+0 de Glória" não é notícia.
  if (workout.isScored && workout.points > 0) stats.push({ label: 'Glória', value: `+${workout.points}` });

  return {
    title: workout.note ?? workoutTypeLabel(workout.type),
    stats: stats.slice(0, 4),
    motto: flavor.motto,
    mark: flavor.mark,
    when: shareDate(workout.performedAt),
    icon: WORKOUT_TYPES.find((type) => type.id === workout.type)?.icon ?? 'outro',
  };
}
