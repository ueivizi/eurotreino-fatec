import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useSession as useAuthSession } from '@/features/auth/session';
import { deviceStorage } from '@/lib/device-storage';

import {
  SESSION_STORAGE_KEY,
  addLap,
  addSet,
  parseSession,
  pauseSession,
  removeLastLap,
  removeLastSet,
  resumeSession,
  startSession,
  type Session,
  type SessionSet,
} from './session';

/**
 * Guarda a sessão em andamento no aparelho e a mantém entre aberturas do app. Uma sessão por vez:
 * começar outra apagaria a primeira sem aviso, então a tela pergunta antes.
 */
type SessionContextValue = {
  /** Sessão em andamento desta conta, ou `null`. */
  current: Session | null;
  /** Ainda lendo o que estava guardado: evita piscar "sem sessão" na abertura. */
  loading: boolean;
  start: (input: { workoutType: Session['workoutType']; requestId: string; routineId?: string | null }) => Promise<Session | null>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  addSet: (set: Omit<SessionSet, 'doneAt'>) => Promise<void>;
  removeLastSet: (exerciseId: string) => Promise<void>;
  addLap: () => Promise<void>;
  removeLastLap: () => Promise<void>;
  discard: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function TrainingSessionProvider({ children }: { children: ReactNode }) {
  const { state } = useAuthSession();
  const userId = state.status === 'ready' ? state.userId : null;
  const [current, setCurrent] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    deviceStorage
      .getItem(SESSION_STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const session = parseSession(raw);
        // Sessão de outra conta usada neste aparelho nunca é retomada.
        setCurrent(session && session.userId === userId ? session : null);
      })
      .catch(() => {
        if (active) setCurrent(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const persist = useCallback(async (session: Session | null) => {
    setCurrent(session);
    try {
      if (session) await deviceStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      else await deviceStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Sem conseguir guardar, a sessão vale nesta abertura do app: melhor isso que perder o treino.
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      current,
      loading,
      start: async ({ workoutType, requestId, routineId }) => {
        if (!userId) return null;
        const session = startSession({ userId, workoutType, requestId, routineId });
        await persist(session);
        return session;
      },
      pause: async () => {
        if (current) await persist(pauseSession(current, new Date()));
      },
      resume: async () => {
        if (current) await persist(resumeSession(current, new Date()));
      },
      addSet: async (set) => {
        if (current) await persist(addSet(current, set, new Date()));
      },
      removeLastSet: async (exerciseId) => {
        if (current) await persist(removeLastSet(current, exerciseId));
      },
      addLap: async () => {
        if (current) await persist(addLap(current, new Date()));
      },
      removeLastLap: async () => {
        if (current) await persist(removeLastLap(current));
      },
      discard: () => persist(null),
    }),
    [current, loading, persist, userId],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useTrainingSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useTrainingSession precisa estar dentro de TrainingSessionProvider.');
  return value;
}
