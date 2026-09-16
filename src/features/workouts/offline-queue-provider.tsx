import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/features/auth/session';
import { deviceStorage } from '@/lib/device-storage';
import { queryKeys } from '@/lib/query-client';
import { ApiError, errorMessage } from '@/lib/rpc-errors';

import { enqueue, forUser, isExpired, parsePendingList, withoutRequest, type PendingWorkout } from './offline-queue';
import { logWorkout } from './workouts-api';

const STORAGE_KEY = 'eurotreino.treinos-pendentes';

export type QueueFailure = { item: PendingWorkout; message: string };

export type NewPendingWorkout = Omit<PendingWorkout, 'userId' | 'queuedAt'>;

export type FlushSummary = { sent: number; failed: number; remaining: number };

type OfflineQueueValue = {
  /** Treinos do usuário atual aguardando envio, do mais antigo ao mais novo. */
  pending: PendingWorkout[];
  /** Treinos que o servidor recusou ao chegar (ex.: passaram de 48 h). */
  failures: QueueFailure[];
  flushing: boolean;
  add: (workout: NewPendingWorkout) => Promise<void>;
  flush: () => Promise<FlushSummary>;
  discardMine: () => Promise<void>;
  dismissFailures: () => void;
};

const OfflineQueueContext = createContext<OfflineQueueValue | null>(null);

async function readQueue(): Promise<PendingWorkout[]> {
  try {
    return parsePendingList(await deviceStorage.getItem(STORAGE_KEY));
  } catch {
    // Armazenamento ilegível: sem fila. Os registros perdidos não pontuaram, e o app segue usável.
    return [];
  }
}

async function writeQueue(list: PendingWorkout[]): Promise<void> {
  if (list.length === 0) await deviceStorage.removeItem(STORAGE_KEY);
  else await deviceStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * NF008: treino registrado sem conexão fica guardado no aparelho e é enviado quando o app volta
 * ao primeiro plano ou a pessoa pede. A Glória só é calculada quando o treino chega ao servidor.
 */
export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const queryClient = useQueryClient();
  const userId = state.status === 'ready' ? state.userId : null;

  const [list, setList] = useState<PendingWorkout[]>([]);
  const [failures, setFailures] = useState<QueueFailure[]>([]);
  const [flushing, setFlushing] = useState(false);
  const flushingRef = useRef(false);
  // Toda leitura e gravação passa por esta fila de promessas: nada se sobrepõe.
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const update = useCallback((change: (current: PendingWorkout[]) => PendingWorkout[]) => {
    const run = chain.current.then(async () => {
      const next = change(await readQueue());
      await writeQueue(next);
      setList(next);
    });
    chain.current = run.catch(() => undefined);
    return run;
  }, []);

  const flush = useCallback(async (): Promise<FlushSummary> => {
    if (!userId || flushingRef.current) return { sent: 0, failed: 0, remaining: userId ? forUser(await readQueue(), userId).length : 0 };
    flushingRef.current = true;
    setFlushing(true);
    let sent = 0;
    const failed: QueueFailure[] = [];

    try {
      for (const item of forUser(await readQueue(), userId)) {
        if (isExpired(item, new Date())) {
          await update((current) => withoutRequest(current, item.requestId));
          failed.push({ item, message: 'Passou do prazo de 48 horas para registrar este treino.' });
          continue;
        }
        try {
          await logWorkout({
            requestId: item.requestId,
            type: item.type,
            durationMin: item.durationMin,
            intensity: item.intensity,
            performedAt: new Date(item.performedAt),
            ...(item.distanceM === undefined ? {} : { distanceM: item.distanceM }),
            ...(item.setsCount === undefined ? {} : { setsCount: item.setsCount }),
            ...(item.loadKg === undefined ? {} : { loadKg: item.loadKg }),
          });
          await update((current) => withoutRequest(current, item.requestId));
          sent += 1;
        } catch (error) {
          // Sem conexão, limite momentâneo ou sessão vencida: o treino continua na fila para depois.
          if (error instanceof ApiError && (error.network || error.code === 'rate_limited' || error.code === 'not_authenticated')) {
            break;
          }
          await update((current) => withoutRequest(current, item.requestId));
          failed.push({ item, message: errorMessage(error) });
        }
      }
    } finally {
      flushingRef.current = false;
      setFlushing(false);
    }

    if (sent > 0) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
    }
    if (failed.length > 0) setFailures((current) => [...current, ...failed]);
    return { sent, failed: failed.length, remaining: forUser(await readQueue(), userId).length };
  }, [userId, update, queryClient]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    // Itens de outra conta usada neste aparelho nunca são enviados nem ficam guardados.
    update((current) => current.filter((item) => item.userId === userId))
      .then(() => {
        if (active) void flush();
      })
      .catch(() => undefined);

    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') void flush();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [userId, update, flush]);

  const add = useCallback(
    async (workout: NewPendingWorkout) => {
      if (!userId) throw new ApiError('Sua sessão terminou. Entre de novo.', 'not_authenticated');
      await update((current) => enqueue(current, { ...workout, userId, queuedAt: new Date().toISOString() }));
    },
    [userId, update],
  );

  const discardMine = useCallback(async () => {
    if (!userId) return;
    await update((current) => current.filter((item) => item.userId !== userId));
  }, [userId, update]);

  const dismissFailures = useCallback(() => setFailures([]), []);

  const pending = useMemo(() => (userId ? forUser(list, userId) : []), [list, userId]);
  const myFailures = useMemo(() => failures.filter((failure) => failure.item.userId === userId), [failures, userId]);

  const value = useMemo(
    () => ({ pending, failures: myFailures, flushing, add, flush, discardMine, dismissFailures }),
    [pending, myFailures, flushing, add, flush, discardMine, dismissFailures],
  );
  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export function useOfflineQueue(): OfflineQueueValue {
  const value = useContext(OfflineQueueContext);
  if (!value) throw new Error('useOfflineQueue precisa estar dentro de OfflineQueueProvider.');
  return value;
}
