/**
 * Dados de exemplo usados pela interface enquanto o app não está ligado ao
 * Supabase. Serão substituídos pelas consultas reais na integração da Onda 1.
 */
import type { EmblemName } from '@/features/profile/emblems';
import type { IntensityId, WorkoutTypeId } from '@/features/workouts/workout-types';

export type SampleMember = {
  id: string;
  name: string;
  emblem: EmblemName;
  /** Glória acumulada (define o rank). */
  glory: number;
  /** Glória da semana (define a posição na Arena). */
  weekGlory: number;
  isMe?: boolean;
};

export const sampleMe = {
  id: 'lucas',
  name: 'Lucas',
  emblem: 'aguia' as EmblemName,
  glory: 468,
  weekGlory: 78,
  legionName: 'Legião Fênix',
  lastWorkout: { type: 'musculacao' as WorkoutTypeId, minutes: 50, intensity: 'moderado' as IntensityId },
};

export const sampleLegion: SampleMember[] = [
  { id: 'digao', name: 'Digão', emblem: 'raio', glory: 1500, weekGlory: 90 },
  { id: 'lucas', name: 'Lucas', emblem: 'aguia', glory: 468, weekGlory: 78, isMe: true },
  { id: 'camila', name: 'Camila', emblem: 'coruja', glory: 128, weekGlory: 52 },
  { id: 'bia', name: 'Bia', emblem: 'tridente', glory: 380, weekGlory: 41 },
  { id: 'rafa', name: 'Rafa', emblem: 'elmo', glory: 190, weekGlory: 30 },
  { id: 'nina', name: 'Nina', emblem: 'pegaso', glory: 80, weekGlory: 14 },
  { id: 'teo', name: 'Téo', emblem: 'loba', glory: 50, weekGlory: 0 },
];
