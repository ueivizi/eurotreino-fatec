/**
 * Números das modalidades, em português do Brasil: distância, ritmo e velocidade.
 *
 * Distância é guardada em metros inteiros, para não arrastar erro de arredondamento binário de
 * registro em registro. A conversão para quilômetro acontece só na hora de mostrar.
 */

import { workoutModule, type WorkoutTypeId } from './workout-types';

/** "800 m" abaixo de 1 km; "7,5 km" acima, com uma casa; sem casa quando é redondo. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const casas = km >= 100 || Number.isInteger(km) ? 0 : 1;
  return `${km.toFixed(casas).replace('.', ',')} km`;
}

/** Ritmo em segundos por quilômetro, no formato de corrida: "4:17 /km". */
export function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—';
  const total = Math.round(secondsPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

export function formatSpeed(kmPerHour: number): string {
  if (!Number.isFinite(kmPerHour) || kmPerHour <= 0) return '—';
  return `${kmPerHour.toFixed(1).replace('.', ',')} km/h`;
}

/** Abaixo de 1 km o ritmo não significa nada: qualquer pique viraria "recorde". */
export const MIN_PACE_DISTANCE_M = 1000;

export function paceSecondsPerKm(meters: number, durationMin: number): number | null {
  if (meters < MIN_PACE_DISTANCE_M || durationMin <= 0) return null;
  return Math.round((durationMin * 60000) / meters);
}

export function speedKmPerHour(meters: number, durationMin: number): number | null {
  if (meters <= 0 || durationMin <= 0) return null;
  return (meters / 1000) / (durationMin / 60);
}

/**
 * Como cada modalidade prefere ser lida: corrida e natação em ritmo, bike em velocidade.
 * A caminhada vai de ritmo, como nos apps de corrida.
 */
export function formatPerformance(type: 'ritmo' | 'velocidade', meters: number, durationMin: number): string | null {
  if (type === 'velocidade') {
    const speed = speedKmPerHour(meters, durationMin);
    return speed === null ? null : formatSpeed(speed);
  }
  const pace = paceSecondsPerKm(meters, durationMin);
  return pace === null ? null : formatPace(pace);
}

/**
 * Ritmo e velocidade só existem na resistência. A distância passou a valer em qualquer modalidade
 * (migração 20260922180000), mas "12:00 /km de musculação" não quer dizer nada: quem pergunta pelo
 * desempenho de um treino de outra família recebe `null`.
 */
export function performanceFor(type: WorkoutTypeId, meters: number, durationMin: number): string | null {
  if (workoutModule(type) !== 'resistencia') return null;
  return formatPerformance(paceModality(type), meters, durationMin);
}

/** Bike se lê em velocidade; corrida, caminhada e natação, em ritmo — como nos apps de cada esporte. */
export function paceModality(type: string): 'ritmo' | 'velocidade' {
  return type === 'bike' ? 'velocidade' : 'ritmo';
}

export function formatLoad(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '—';
  return `${(Number.isInteger(kg) ? kg.toFixed(0) : kg.toFixed(1)).replace('.', ',')} kg`;
}
