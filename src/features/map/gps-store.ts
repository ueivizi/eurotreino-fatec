import { useSyncExternalStore } from 'react';

import { EMPTY_TRACK, addFix, type Fix, type Track } from './gps-track';

/**
 * Percurso da sessão em andamento, só na memória do aparelho. Sobrevive a sair e voltar à tela da
 * sessão; não sobrevive ao app ser fechado (o GPS é só com o app aberto, por decisão do projeto).
 */
let key: string | null = null;
let track: Track = EMPTY_TRACK;
let lastAccuracy: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function recordFix(sessionKey: string, fix: Fix) {
  if (key !== sessionKey) {
    key = sessionKey;
    track = EMPTY_TRACK;
  }
  lastAccuracy = fix.accuracy;
  const next = addFix(track, fix);
  if (next !== track) track = next;
  emit();
}

export function clearTrack() {
  key = null;
  track = EMPTY_TRACK;
  lastAccuracy = null;
  emit();
}

export function currentTrack(sessionKey: string): Track {
  return key === sessionKey ? track : EMPTY_TRACK;
}

type Snapshot = { track: Track; accuracy: number | null };
let snapshot: Snapshot = { track, accuracy: lastAccuracy };

function getSnapshot(): Snapshot {
  if (snapshot.track !== track || snapshot.accuracy !== lastAccuracy) snapshot = { track, accuracy: lastAccuracy };
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Percurso e precisão da última leitura para a sessão pedida. */
export function useTrack(sessionKey: string | null): Snapshot {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return sessionKey !== null && key === sessionKey ? value : { track: EMPTY_TRACK, accuracy: null };
}
