/**
 * Horário do treino para registro retroativo (até 48 h, nunca no futuro), no fuso do aparelho.
 * O servidor valida de novo; aqui só se oferecem horários que ele vai aceitar.
 */

import { SCORING } from '@/features/ranks/scoring';

const MINUTE_MS = 60_000;
export const TIME_STEP_MINUTES = 15;
export const LATE_LOG_WINDOW_MS = SCORING.lateLogHours * 60 * MINUTE_MS;
/** Folga para o tempo entre escolher o horário e o pedido chegar ao servidor. */
const SAFETY_MS = 10 * MINUTE_MS;

export const DAY_LABELS = ['Hoje', 'Ontem', 'Anteontem'] as const;

function atMinute(date: Date, minutes: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), minutes, 0, 0);
}

function floorToStep(date: Date): Date {
  return atMinute(date, Math.floor(date.getMinutes() / TIME_STEP_MINUTES) * TIME_STEP_MINUTES);
}

function ceilToStep(date: Date): Date {
  const floored = floorToStep(date);
  return floored.getTime() === date.getTime() ? floored : new Date(floored.getTime() + TIME_STEP_MINUTES * MINUTE_MS);
}

/** Primeiro e último horário que podem ser escolhidos agora. */
export function performedAtBounds(now: Date): { min: Date; max: Date } {
  return {
    min: ceilToStep(new Date(now.getTime() - LATE_LOG_WINDOW_MS + SAFETY_MS)),
    max: floorToStep(now),
  };
}

export function clampPerformedAt(date: Date, now: Date): Date {
  const { min, max } = performedAtBounds(now);
  const stepped = floorToStep(date);
  if (stepped < min) return min;
  if (stepped > max) return max;
  return stepped;
}

/** Sugestão ao abrir a escolha de horário: uma hora atrás. */
export function suggestedPerformedAt(now: Date): Date {
  return clampPerformedAt(new Date(now.getTime() - 60 * MINUTE_MS), now);
}

/** Um passo de 15 minutos para frente ou para trás; `null` se sairia da janela permitida. */
export function stepPerformedAt(date: Date, direction: 1 | -1, now: Date): Date | null {
  const next = new Date(date.getTime() + direction * TIME_STEP_MINUTES * MINUTE_MS);
  const { min, max } = performedAtBounds(now);
  return next < min || next > max ? null : next;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** 0 = hoje, 1 = ontem, 2 = anteontem, pelo calendário do aparelho. */
export function dayOffsetOf(date: Date, now: Date): number {
  return Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / (24 * 60 * MINUTE_MS));
}

/** Dias que têm ao menos um horário aceito. */
export function availableDayOffsets(now: Date): number[] {
  const { min } = performedAtBounds(now);
  return [0, 1, 2].filter((offset) => offset <= dayOffsetOf(min, now));
}

/** Mesmo horário em outro dia, ajustado para dentro da janela. */
export function withDayOffset(date: Date, offset: number, now: Date): Date {
  const day = startOfDay(now);
  const target = new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset, date.getHours(), date.getMinutes());
  return clampPerformedAt(target, now);
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

/** "Agora", "Hoje, 07:30", "Ontem, 18:00" ou "Anteontem, 21:15". */
export function describePerformedAt(date: Date | null, now: Date): string {
  if (!date) return 'Agora';
  const offset = dayOffsetOf(date, now);
  const label = DAY_LABELS[offset] ?? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
  return `${label}, ${formatTime(date)}`;
}
