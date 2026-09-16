/**
 * Fila de treinos registrados sem conexão (NF008). Cada item guarda o identificador do registro:
 * reenviar nunca pontua duas vezes. Os itens pertencem a um usuário e só são enviados na sessão dele.
 * O conteúdo lido do aparelho é tratado como externo: itens fora do formato são descartados.
 */

import { isIsoDate, isRow, isUuid } from '@/lib/parse';

import { LATE_LOG_WINDOW_MS } from './performed-at';
import {
  DISTANCE,
  DURATION,
  LOAD,
  SETS,
  isIntensityId,
  isWorkoutTypeId,
  workoutModule,
  type IntensityId,
  type WorkoutTypeId,
} from './workout-types';

export type PendingWorkout = {
  userId: string;
  requestId: string;
  type: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  /** Quando o treino aconteceu (ISO 8601). */
  performedAt: string;
  /** Quando foi guardado no aparelho (ISO 8601). */
  queuedAt: string;
  /** Detalhes da modalidade, quando informados. */
  distanceM?: number;
  setsCount?: number;
  loadKg?: number;
};

export const MAX_PENDING_PER_USER = 20;

export class QueueFullError extends Error {
  constructor() {
    super('A fila de treinos deste aparelho está cheia.');
    this.name = 'QueueFullError';
  }
}

/** Detalhe opcional: ausente é válido; presente precisa estar na faixa e na família certa. */
function detail(value: unknown, min: number, max: number, allowed: boolean, integer: boolean): number | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!allowed || typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (integer && !Number.isInteger(value)) return null;
  if (!integer && (value * 2) !== Math.floor(value * 2)) return null;
  return value >= min && value <= max ? value : null;
}

function parseItem(value: unknown): PendingWorkout | null {
  if (!isRow(value)) return null;
  const { userId, requestId, type, durationMin, intensity, performedAt, queuedAt } = value;
  if (!isUuid(userId) || !isUuid(requestId) || !isWorkoutTypeId(type) || !isIntensityId(intensity)) return null;
  if (typeof durationMin !== 'number' || !Number.isInteger(durationMin)) return null;
  if (durationMin < DURATION.min || durationMin > DURATION.max) return null;
  if (!isIsoDate(performedAt) || !isIsoDate(queuedAt)) return null;

  const module = workoutModule(type);
  const distanceM = detail(value.distanceM, DISTANCE.min, DISTANCE.max, module === 'resistencia', true);
  const setsCount = detail(value.setsCount, SETS.min, SETS.max, module === 'forca', true);
  const loadKg = detail(value.loadKg, LOAD.min, LOAD.max, module === 'forca', false);
  // Detalhe corrompido ou fora da família derruba o item inteiro: o servidor o recusaria de todo
  // jeito, e um treino "quase certo" no histórico é pior que um treino descartado aqui.
  if (distanceM === null || setsCount === null || loadKg === null) return null;

  return {
    userId,
    requestId,
    type,
    durationMin,
    intensity,
    performedAt,
    queuedAt,
    ...(distanceM === undefined ? {} : { distanceM }),
    ...(setsCount === undefined ? {} : { setsCount }),
    ...(loadKg === undefined ? {} : { loadKg }),
  };
}

export function parsePendingList(raw: string | null): PendingWorkout[] {
  if (raw === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const items = value.map(parseItem).filter((item): item is PendingWorkout => item !== null);
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.requestId)) return false;
    seen.add(item.requestId);
    return true;
  });
}

export function forUser(list: readonly PendingWorkout[], userId: string): PendingWorkout[] {
  return list
    .filter((item) => item.userId === userId)
    .sort((a, b) => Date.parse(a.performedAt) - Date.parse(b.performedAt));
}

export function enqueue(list: readonly PendingWorkout[], item: PendingWorkout): PendingWorkout[] {
  if (list.some((existing) => existing.requestId === item.requestId)) return [...list];
  if (forUser(list, item.userId).length >= MAX_PENDING_PER_USER) throw new QueueFullError();
  return [...list, item];
}

export function withoutRequest(list: readonly PendingWorkout[], requestId: string): PendingWorkout[] {
  return list.filter((item) => item.requestId !== requestId);
}

/** Treino que o servidor já não aceitaria: aconteceu há mais de 48 horas. */
export function isExpired(item: PendingWorkout, now: Date): boolean {
  return Date.parse(item.performedAt) < now.getTime() - LATE_LOG_WINDOW_MS;
}
