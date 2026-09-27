import { useEffect, useState } from 'react';

import { deviceStorage } from '@/lib/device-storage';

/** Posição de cada um na última vez que a pessoa abriu este Coliseu, guardada só no aparelho. */
type Places = Record<string, number>;

const PREFIX = 'eurotreino.coliseu.';

function parsePlaces(raw: string | null): Places {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const places: Places = {};
    for (const [userId, place] of Object.entries(value)) {
      if (typeof place === 'number' && Number.isInteger(place) && place > 0 && userId.length <= 64) places[userId] = place;
    }
    return places;
  } catch {
    return {};
  }
}

/** Quantas posições cada um subiu (+) ou desceu (-) desde a última visita. Zero não aparece. */
export function placeChanges(before: Places, entries: readonly { userId: string; place: number }[]): Record<string, number> {
  const changes: Record<string, number> = {};
  for (const entry of entries) {
    const previous = before[entry.userId];
    if (previous !== undefined && previous !== entry.place) changes[entry.userId] = previous - entry.place;
  }
  return changes;
}

/**
 * Setas de subida e descida no Coliseu. A chave é da Legião e da semana: segunda-feira recomeça.
 * A nova posição é guardada logo depois de a tela calcular a mudança.
 */
export function usePlaceChanges(key: string | null, entries: readonly { userId: string; place: number }[]): Record<string, number> {
  const [changes, setChanges] = useState<Record<string, number>>({});
  const signature = entries.map((entry) => `${entry.userId}:${entry.place}`).join(',');

  useEffect(() => {
    // A lista muda de identidade a cada busca; as posições, não. A assinatura carrega as duas coisas.
    const current = signature
      .split(',')
      .filter(Boolean)
      .map((pair) => {
        const [userId = '', place = '0'] = pair.split(':');
        return { userId, place: Number(place) };
      });
    if (!key || current.length === 0) return;
    let alive = true;
    const storageKey = PREFIX + key;
    void deviceStorage
      .getItem(storageKey)
      .then(async (raw) => {
        if (!alive) return;
        setChanges(placeChanges(parsePlaces(raw), current));
        const places: Places = {};
        for (const entry of current) places[entry.userId] = entry.place;
        await deviceStorage.setItem(storageKey, JSON.stringify(places));
      })
      // Sem armazenamento, só não há setas: o Coliseu continua certo.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key, signature]);

  return changes;
}
