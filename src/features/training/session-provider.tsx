import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useSession as useAuthSession } from '@/features/auth/session';
import { LOAD } from '@/features/workouts/workout-types';
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
  setFocus,
  startSession,
  type Session,
  type SessionFocus,
  type SessionSet,
} from './session';
import {
  NOTIFICATION_LOAD_STEP,
  SESSION_ACTIONS,
  clearSessionNotification,
  ensureSessionNotificationPermission,
  isSessionAction,
  showSessionNotification,
  type SessionAction,
} from './session-notification';

/** De quanto em quanto tempo o relógio da notificação é repintado enquanto o treino corre. */
const CLOCK_REFRESH_MS = 60_000;

/**
 * Guarda a sessão em andamento no aparelho e a mantém entre aberturas do app. Uma sessão por vez:
 * começar outra apagaria a primeira sem aviso, então a tela pergunta antes.
 */
type SessionContextValue = {
  /** Sessão em andamento desta conta, ou `null`. */
  current: Session | null;
  /** Ainda lendo o que estava guardado: evita piscar "sem sessão" na abertura. */
  loading: boolean;
  start: (input: {
    workoutType: Session['workoutType'];
    requestId: string;
    routineId?: string | null;
    routineName?: string | null;
  }) => Promise<Session | null>;
  /** O exercício e os números da vez, que a notificação da tela bloqueada usa. */
  setFocus: (focus: SessionFocus | null) => Promise<void>;
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

  /*
   * A notificação é o espelho da sessão: sempre que a sessão muda, ela é repintada; quando a
   * sessão acaba, ela some. O relógio é repintado de minuto em minuto, e só enquanto corre --
   * repintar parado seria gastar bateria para mostrar o mesmo número.
   */
  useEffect(() => {
    if (!current) {
      void clearSessionNotification();
      return;
    }
    const paint = () =>
      void showSessionNotification(current, {
        exerciseName: current.focus?.exerciseName ?? null,
        routineName: current.routineName,
      }).catch(() => undefined);
    paint();
    if (current.pausedAt) return;
    const timer = setInterval(paint, CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [current]);

  /** Botão da notificação: o que ele faz é o mesmo que a tela faria. */
  const applyAction = useCallback(
    async (action: SessionAction, session: Session) => {
      const now = new Date();
      if (action === SESSION_ACTIONS.setDone) {
        if (!session.focus) return;
        await persist(
          addSet(session, { exerciseId: session.focus.exerciseId, reps: session.focus.reps, loadKg: session.focus.loadKg }, now),
        );
        return;
      }
      if (action === SESSION_ACTIONS.loadUp || action === SESSION_ACTIONS.loadDown) {
        if (!session.focus) return;
        const step = action === SESSION_ACTIONS.loadUp ? NOTIFICATION_LOAD_STEP : -NOTIFICATION_LOAD_STEP;
        const next = Math.round(((session.focus.loadKg ?? 0) + step) * 10) / 10;
        await persist(setFocus(session, { ...session.focus, loadKg: next >= LOAD.min ? Math.min(LOAD.max, next) : null }));
        return;
      }
      if (action === SESSION_ACTIONS.lap) {
        await persist(addLap(session, now));
        return;
      }
      if (action === SESSION_ACTIONS.pause) {
        await persist(pauseSession(session, now));
        return;
      }
      if (action === SESSION_ACTIONS.resume) {
        await persist(resumeSession(session, now));
      }
    },
    [persist],
  );

  /* O que chega do sistema é dado de fora: só identificador conhecido vira ação. */
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      if (!current || typeof action !== 'string' || !isSessionAction(action)) return;
      void applyAction(action, current);
    });
    return () => subscription.remove();
  }, [applyAction, current]);

  const value = useMemo<SessionContextValue>(
    () => ({
      current,
      loading,
      start: async ({ workoutType, requestId, routineId, routineName }) => {
        if (!userId) return null;
        const session = startSession({ userId, workoutType, requestId, routineId, routineName });
        await persist(session);
        // A permissão é pedida no começo do treino, que é quando a notificação passa a servir.
        void ensureSessionNotificationPermission().catch(() => false);
        return session;
      },
      setFocus: async (focus) => {
        if (current) await persist(setFocus(current, focus));
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
