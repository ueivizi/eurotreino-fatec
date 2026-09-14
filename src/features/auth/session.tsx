import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { fetchOwnProfile, type Profile, type ProfileLookup } from '@/features/profile/profile-api';
import { queryClient } from '@/lib/query-client';
import { getSupabase } from '@/lib/supabase';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'needs-profile'; userId: string; email: string | null }
  | { status: 'ready'; userId: string; email: string | null; profile: Profile }
  | { status: 'unavailable' };

type SessionContextValue = {
  state: SessionState;
  signOut: () => Promise<void>;
  retry: () => void;
  profileSaved: (profile: Profile) => void;
};

type AuthIdentity = { known: false } | { known: true; userId: string | null; email: string | null };

/** Resultado da busca do perfil, amarrado ao usuário e à tentativa que o produziu. */
type ProfileResult = { userId: string; attempt: number; lookup: ProfileLookup };

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Estado de entrada do app: sem sessão → entrar; com sessão e sem perfil → perfil inicial;
 * com perfil → abas. As telas de cada estado ficam protegidas no layout raiz.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<AuthIdentity>({ known: false });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      // Só guarda quem é o usuário. Chamar o Supabase dentro deste callback trava a biblioteca,
      // por isso o perfil é buscado no efeito abaixo. Renovação de token não muda a pessoa.
      const userId = session?.user.id ?? null;
      const email = session?.user.email ?? null;
      if (lastUserId.current !== undefined && lastUserId.current !== userId) {
        // Troca de conta no mesmo aparelho: nada do usuário anterior pode continuar em cache.
        queryClient.clear();
      }
      lastUserId.current = userId;
      setIdentity((current) =>
        current.known && current.userId === userId ? current : { known: true, userId, email },
      );
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!identity.known || identity.userId === null) return;
    const { userId } = identity;

    let active = true;
    fetchOwnProfile(userId)
      .then((lookup) => {
        if (active) setResult({ userId, attempt, lookup });
      })
      .catch(() => {
        if (active) setResult({ userId, attempt, lookup: { kind: 'error' } });
      });

    return () => {
      active = false;
    };
  }, [identity, attempt]);

  const state = useMemo<SessionState>(() => {
    if (!identity.known) return { status: 'loading' };
    const { userId, email } = identity;
    if (userId === null) return { status: 'signed-out' };
    if (!result || result.userId !== userId || result.attempt !== attempt) return { status: 'loading' };

    switch (result.lookup.kind) {
      case 'found':
        return { status: 'ready', userId, email, profile: result.lookup.profile };
      case 'missing':
        return { status: 'needs-profile', userId, email };
      default:
        return { status: 'unavailable' };
    }
  }, [identity, result, attempt]);

  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) {
      // Sem rede, a revogação no servidor falha, mas a sessão precisa sair deste aparelho mesmo assim.
      await getSupabase().auth.signOut({ scope: 'local' });
    }
  }, []);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const profileSaved = useCallback(
    (profile: Profile) => setResult({ userId: profile.id, attempt, lookup: { kind: 'found', profile } }),
    [attempt],
  );

  const value = useMemo(() => ({ state, signOut, retry, profileSaved }), [state, signOut, retry, profileSaved]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession precisa estar dentro de SessionProvider.');
  return value;
}

/** Perfil de quem está usando o app; `null` durante transições (ex.: logo após sair). */
export function useProfile(): Profile | null {
  const { state } = useSession();
  return state.status === 'ready' ? state.profile : null;
}
