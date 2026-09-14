import './polyfills';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { authStorage } from './auth-storage';
import type { Database } from './database.types';
import { parseSupabaseConfig } from './supabase-config';

/** Lida uma vez; o Expo embute as variáveis EXPO_PUBLIC_* no app durante o build. */
export const supabaseConfig = parseSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseConfig.ok) {
    throw new Error('Supabase não configurado: confira o arquivo .env.');
  }
  if (client) return client;

  const created = createClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  if (Platform.OS !== 'web') {
    // Nos apps nativos, o token só é renovado com o app em primeiro plano (orientação do Supabase).
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void created.auth.startAutoRefresh();
      else void created.auth.stopAutoRefresh();
    });
  }

  client = created;
  return created;
}
