import type { IconName } from '@/components/ui/icon';

/**
 * Família da modalidade (espelha workout_types.module no banco, conferido pelo teste de sincronia):
 * resistência aceita distância; força aceita séries e carga; "outro" não aceita detalhe nenhum.
 * Nenhum desses detalhes muda a Glória — a regra v1 vale igual para todas as modalidades.
 */
export const MODULES = ['resistencia', 'forca', 'outro'] as const;
export type ModuleId = (typeof MODULES)[number];

export const WORKOUT_TYPES = [
  { id: 'musculacao', label: 'Musculação', icon: 'musculacao', module: 'forca' },
  { id: 'corrida', label: 'Corrida', icon: 'corrida', module: 'resistencia' },
  { id: 'caminhada', label: 'Caminhada', icon: 'caminhada', module: 'resistencia' },
  { id: 'bike', label: 'Bike', icon: 'bike', module: 'resistencia' },
  { id: 'natacao', label: 'Natação', icon: 'natacao', module: 'resistencia' },
  { id: 'funcional', label: 'Funcional', icon: 'funcional', module: 'forca' },
  { id: 'esporte', label: 'Esporte', icon: 'esporte', module: 'outro' },
  { id: 'yoga', label: 'Yoga', icon: 'yoga', module: 'outro' },
  { id: 'outro', label: 'Outro', icon: 'outro', module: 'outro' },
] as const satisfies readonly { id: string; label: string; icon: IconName; module: ModuleId }[];

export type WorkoutTypeId = (typeof WORKOUT_TYPES)[number]['id'];

export function workoutModule(id: WorkoutTypeId): ModuleId {
  const found = WORKOUT_TYPES.find((type) => type.id === id);
  if (!found) throw new RangeError(`Tipo de treino desconhecido: ${id}`);
  return found.module;
}

export const INTENSITIES = [
  { id: 'leve', label: 'Leve' },
  { id: 'moderado', label: 'Moderado' },
  { id: 'intenso', label: 'Intenso' },
] as const;

export type IntensityId = (typeof INTENSITIES)[number]['id'];

/** Mesmos limites que o servidor vai validar (RF006): de 1 a 300 minutos. */
export const DURATION = { min: 1, max: 300, step: 5 } as const;

/** Detalhes opcionais, com os mesmos limites do banco (a validação de verdade é lá). */
export const DISTANCE = { min: 10, max: 200000, step: 100 } as const;
export const SETS = { min: 1, max: 60, step: 1 } as const;
export const LOAD = { min: 0.5, max: 500, step: 2.5 } as const;

export function stepDuration(current: number, direction: 1 | -1): number {
  const safe = Number.isInteger(current) ? current : DURATION.min;
  const next = safe + direction * DURATION.step;
  return Math.min(DURATION.max, Math.max(DURATION.min, next));
}

export function isWorkoutTypeId(value: unknown): value is WorkoutTypeId {
  return WORKOUT_TYPES.some((type) => type.id === value);
}

export function isIntensityId(value: unknown): value is IntensityId {
  return INTENSITIES.some((intensity) => intensity.id === value);
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
