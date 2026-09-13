import type { IconName } from '@/components/ui/icon';

export const WORKOUT_TYPES = [
  { id: 'musculacao', label: 'Musculação', icon: 'musculacao' },
  { id: 'corrida', label: 'Corrida', icon: 'corrida' },
  { id: 'caminhada', label: 'Caminhada', icon: 'caminhada' },
  { id: 'bike', label: 'Bike', icon: 'bike' },
  { id: 'natacao', label: 'Natação', icon: 'natacao' },
  { id: 'funcional', label: 'Funcional', icon: 'funcional' },
  { id: 'esporte', label: 'Esporte', icon: 'esporte' },
  { id: 'yoga', label: 'Yoga', icon: 'yoga' },
  { id: 'outro', label: 'Outro', icon: 'outro' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

export type WorkoutTypeId = (typeof WORKOUT_TYPES)[number]['id'];

export const INTENSITIES = [
  { id: 'leve', label: 'Leve' },
  { id: 'moderado', label: 'Moderado' },
  { id: 'intenso', label: 'Intenso' },
] as const;

export type IntensityId = (typeof INTENSITIES)[number]['id'];

/** Mesmos limites que o servidor vai validar (RF006): de 1 a 300 minutos. */
export const DURATION = { min: 1, max: 300, step: 5 } as const;

export function stepDuration(current: number, direction: 1 | -1): number {
  const safe = Number.isInteger(current) ? current : DURATION.min;
  const next = safe + direction * DURATION.step;
  return Math.min(DURATION.max, Math.max(DURATION.min, next));
}

export function workoutTypeLabel(id: WorkoutTypeId): string {
  const found = WORKOUT_TYPES.find((type) => type.id === id);
  if (!found) throw new RangeError(`Tipo de treino desconhecido: ${id}`);
  return found.label;
}

export function intensityLabel(id: IntensityId): string {
  const found = INTENSITIES.find((intensity) => intensity.id === id);
  if (!found) throw new RangeError(`Intensidade desconhecida: ${id}`);
  return found.label;
}
