import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from './rpc-errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Erro com código conhecido (ex.: not_a_member) não melhora com nova tentativa.
      retry: (failureCount, error) => !(error instanceof ApiError && error.code !== null) && failureCount < 1,
    },
    mutations: {
      retry: false,
    },
  },
});

export const queryKeys = {
  progress: ['progress'] as const,
  records: ['records'] as const,
  legions: ['legions'] as const,
  invite: (legionId: string) => ['legions', legionId, 'invite'] as const,
  rankings: ['ranking'] as const,
  ranking: (legionId: string, weekOffset: 0 | -1) => ['ranking', legionId, weekOffset] as const,
};

if (Platform.OS !== 'web') {
  // Ao voltar para o app, as consultas vencidas são atualizadas (no navegador o React Query já faz isso).
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
    return () => subscription.remove();
  });
}
