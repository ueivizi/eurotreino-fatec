import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useSession as useAuthSession } from '@/features/auth/session';
import { LOAD } from '@/features/workouts/workout-types';
import { deviceStorage } from '@/lib/device-storage';

import { applyCardEvents, cardState } from './lock-card';
import { LOCK_CARD_AVAILABLE, drainLockCardEvents, hideLockCard, onLockCardAction, showLockCard } from './lock-card-native';
import {
  SESSION_STORAGE_KEY,
  addLap,
  markFocusedSet,
  parseSession,
  pauseSession,
  removeLastLap,
  removeLastSet,
  resumeSession,
  setFocus,
  setPlan,
  startSession,
  type PlanItem,
  type Session,
  type SessionFocus,
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
    routeId?: string | null;
    plan?: readonly PlanItem[];
  }) => Promise<Session | null>;
  /** O exercício e os números da vez, que o cartão da tela bloqueada usa. */
  setFocus: (focus: SessionFocus | null) => Promise<void>;
  /** Exercícios da ficha e avulsos, com nome e meta: o cartão precisa deles com o app fechado. */
  setPlan: (plan: readonly PlanItem[]) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Série do exercício da vez; devolve se ela fechou a meta (e o foco passou ao próximo). */
  markSet: () => Promise<{ completed: boolean }>;
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
  /*
   * A versão mais nova da sessão, para as ações partirem sempre dela: dois toques seguidos (ou um
   * toque no cartão enquanto a tela grava) não podem partir da mesma cópia e apagar um ao outro.
   */
  const latest = useRef<Session | null>(null);

  useEffect(() => {
    let active = true;
    deviceStorage
      .getItem(SESSION_STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const session = parseSession(raw);
        // Sessão de outra conta usada neste aparelho nunca é retomada.
        const mine = session && session.userId === userId ? session : null;
        latest.current = mine;
        setCurrent(mine);
      })
      .catch(() => {
        if (!active) return;
        latest.current = null;
        setCurrent(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const persist = useCallback(async (session: Session | null) => {
    latest.current = session;
    setCurrent(session);
    try {
      if (session) await deviceStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      else await deviceStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Sem conseguir guardar, a sessão vale nesta abertura do app: melhor isso que perder o treino.
    }
  }, []);

  /** Aplica uma mudança sobre a versão mais nova da sessão e grava. */
  const update = useCallback(
    async (change: (session: Session) => Session) => {
      const session = latest.current;
      if (!session) return;
      const next = change(session);
      if (next !== session) await persist(next);
    },
    [persist],
  );

  /*
   * O cartão da tela bloqueada é o espelho da sessão: muda quando ela muda e some quando ela acaba.
   * No Android o relógio corre sozinho no cartão nativo — nada de repintar de minuto em minuto, que
   * virava uma notificação nova a cada minuto (achado do teste de 27/09). Fora dele (iPhone), fica a
   * notificação comum, sem relógio.
   */
  useEffect(() => {
    if (!current) {
      hideLockCard();
      void clearSessionNotification();
      return;
    }
    if (LOCK_CARD_AVAILABLE) {
      showLockCard(cardState(current, new Date()));
      return;
    }
    void showSessionNotification(current, {
      exerciseName: current.focus?.exerciseName ?? null,
      routineName: current.routineName,
    }).catch(() => undefined);
  }, [current]);

  // A notificação antiga (de versões anteriores) não pode ficar ao lado do cartão novo.
  useEffect(() => {
    if (LOCK_CARD_AVAILABLE) void clearSessionNotification();
  }, []);

  /** Toques feitos no cartão (com o app aberto ou fechado) entram na sessão com as regras da tela. */
  const drainCard = useCallback(async () => {
    const events = drainLockCardEvents();
    if (events.length === 0) return;
    await update((session) => applyCardEvents(session, events, new Date()));
  }, [update]);

  useEffect(() => {
    if (!loading) void drainCard();
  }, [loading, drainCard]);

  useEffect(() => onLockCardAction(() => void drainCard()), [drainCard]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void drainCard();
    });
    return () => subscription.remove();
  }, [drainCard]);

  /** Botão da notificação comum (fora do Android): o que ele faz é o mesmo que a tela faria. */
  const applyAction = useCallback(
    async (action: SessionAction) => {
      const now = new Date();
      await update((session) => {
        if (action === SESSION_ACTIONS.setDone) return markFocusedSet(session, now).session;
        if (action === SESSION_ACTIONS.loadUp || action === SESSION_ACTIONS.loadDown) {
          if (!session.focus) return session;
          const step = action === SESSION_ACTIONS.loadUp ? NOTIFICATION_LOAD_STEP : -NOTIFICATION_LOAD_STEP;
          const next = Math.round(((session.focus.loadKg ?? 0) + step) * 10) / 10;
          return setFocus(session, { ...session.focus, loadKg: next >= LOAD.min ? Math.min(LOAD.max, next) : null });
        }
        if (action === SESSION_ACTIONS.lap) return addLap(session, now);
        if (action === SESSION_ACTIONS.pause) return pauseSession(session, now);
        if (action === SESSION_ACTIONS.resume) return resumeSession(session, now);
        return session;
      });
    },
    [update],
  );

  /* O que chega do sistema é dado de fora: só identificador conhecido vira ação. */
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      if (typeof action !== 'string' || !isSessionAction(action)) return;
      void applyAction(action);
    });
    return () => subscription.remove();
  }, [applyAction]);

  const value = useMemo<SessionContextValue>(
    () => ({
      current,
      loading,
      start: async ({ workoutType, requestId, routineId, routineName, routeId, plan }) => {
        if (!userId) return null;
        const session = startSession({ userId, workoutType, requestId, routineId, routineName, routeId, plan });
        await persist(session);
        // A permissão é pedida no começo do treino, que é quando o cartão passa a servir.
        void ensureSessionNotificationPermission().catch(() => false);
        return session;
      },
      setFocus: (focus) => update((session) => setFocus(session, focus)),
      setPlan: (plan) => update((session) => setPlan(session, plan)),
      pause: () => update((session) => pauseSession(session, new Date())),
      resume: () => update((session) => resumeSession(session, new Date())),
      markSet: async () => {
        const session = latest.current;
        if (!session) return { completed: false };
        const result = markFocusedSet(session, new Date());
        if (result.session !== session) await persist(result.session);
        return { completed: result.completed };
      },
      removeLastSet: (exerciseId) => update((session) => removeLastSet(session, exerciseId)),
      addLap: () => update((session) => addLap(session, new Date())),
      removeLastLap: () => update((session) => removeLastLap(session)),
      discard: () => persist(null),
    }),
    [current, loading, persist, update, userId],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useTrainingSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useTrainingSession precisa estar dentro de TrainingSessionProvider.');
  return value;
}
