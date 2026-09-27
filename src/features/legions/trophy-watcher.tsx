import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { enqueueCelebrations } from '@/features/celebrations/celebration-store';
import { deviceStorage } from '@/lib/device-storage';
import { queryKeys } from '@/lib/query-client';

import { fetchMyLegions } from './legions-api';
import { fetchTrophies, settleSeasons } from './season-api';
import type { Trophy } from './season-parsers';

const SEEN_KEY = 'eurotreino.triunfos.vistos';
const MAX_SEEN = 100;
/** Triunfo antigo, visto pela primeira vez num aparelho novo, não vira cerimônia. */
const RECENT_MS = 14 * 24 * 60 * 60 * 1000;

/** Legiões já apuradas nesta abertura do app: a apuração é idempotente, mas não precisa repetir. */
const settled = new Set<string>();

function trophyKey(trophy: Trophy): string {
  return `${trophy.kind}:${trophy.seasonStart}:${trophy.groupName ?? ''}`;
}

function parseSeen(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, MAX_SEEN) : [];
  } catch {
    return [];
  }
}

/**
 * Apura as temporadas das Legiões competitivas quando o app abre e toca a cerimônia dos Triunfos
 * que a pessoa ainda não viu neste aparelho. Não desenha nada.
 */
export function TrophyWatcher() {
  const queryClient = useQueryClient();
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const competitive = (legions.data ?? []).filter((legion) => legion.mode === 'competitiva').map((legion) => legion.id);
  const competitiveKey = competitive.join(',');

  useEffect(() => {
    const pending = competitiveKey.split(',').filter((id) => id && !settled.has(id));
    if (pending.length === 0) return;
    for (const id of pending) settled.add(id);
    void Promise.allSettled(pending.map((id) => settleSeasons(id))).then(() =>
      queryClient.invalidateQueries({ queryKey: queryKeys.trophies('eu') }),
    );
  }, [competitiveKey, queryClient]);

  const trophies = useQuery({ queryKey: queryKeys.trophies('eu'), queryFn: () => fetchTrophies() });

  useEffect(() => {
    const list = trophies.data;
    if (!list || list.length === 0) return;
    let alive = true;
    void deviceStorage
      .getItem(SEEN_KEY)
      .then(async (raw) => {
        if (!alive) return;
        const seen = new Set(parseSeen(raw));
        const now = Date.now();
        const fresh = list.filter(
          (trophy) =>
            !seen.has(trophyKey(trophy)) && trophy.awardedAt !== null && now - Date.parse(trophy.awardedAt) < RECENT_MS,
        );
        const all = [...new Set([...list.map(trophyKey), ...seen])].slice(0, MAX_SEEN);
        await deviceStorage.setItem(SEEN_KEY, JSON.stringify(all));
        if (!alive || fresh.length === 0) return;
        enqueueCelebrations(
          fresh.map((trophy) => ({ kind: 'trophy' as const, trophy: trophy.kind, legionName: trophy.groupName, louros: trophy.louros })),
        );
      })
      // Sem armazenamento, a cerimônia fica para outra vez; os Triunfos continuam no perfil.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [trophies.data]);

  return null;
}
