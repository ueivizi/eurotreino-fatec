import { useSyncExternalStore } from 'react';

import type { Celebration } from './celebration-types';

export type QueuedCelebration = { id: number; celebration: Celebration };

/** Mais que isso vira maratona: o excedente é descartado, nunca acumulado. */
const MAX_QUEUE = 6;

let queue: readonly QueuedCelebration[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function enqueueCelebrations(items: readonly Celebration[]) {
  if (items.length === 0) return;
  const room = Math.max(0, MAX_QUEUE - queue.length);
  if (room === 0) return;
  queue = [...queue, ...items.slice(0, room).map((celebration) => ({ id: nextId++, celebration }))];
  emit();
}

export function dismissCelebration(id: number) {
  const next = queue.filter((item) => item.id !== id);
  if (next.length === queue.length) return;
  queue = next;
  emit();
}

/** Ao sair da conta ou fechar as abas: nada de cerimônia de outra sessão. */
export function clearCelebrations() {
  if (queue.length === 0) return;
  queue = [];
  emit();
}

export function peekCelebrations(): readonly QueuedCelebration[] {
  return queue;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getCurrent(): QueuedCelebration | null {
  return queue[0] ?? null;
}

function getPendingCount(): number {
  return queue.length;
}

/** Cerimônia da vez (a primeira da fila). */
export function useCurrentCelebration(): QueuedCelebration | null {
  return useSyncExternalStore(subscribe, getCurrent, getCurrent);
}

export function usePendingCelebrations(): number {
  return useSyncExternalStore(subscribe, getPendingCount, getPendingCount);
}
