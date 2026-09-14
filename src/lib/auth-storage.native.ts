import * as SecureStore from 'expo-secure-store';

import { createChunkedStorage } from './chunked-storage';

/**
 * Sessão do Supabase no Keychain (iOS) e no Keystore (Android), em pedaços (NF011).
 * Acesso só com o aparelho desbloqueado: a renovação do token acontece com o app aberto.
 */
export const authStorage = createChunkedStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
});
