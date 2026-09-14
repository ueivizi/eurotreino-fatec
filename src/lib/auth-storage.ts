import type { KeyValueBackend } from './chunked-storage';

/**
 * Na Web não existe Keychain: a sessão fica no localStorage do navegador, como é o padrão do
 * supabase-js. Risco aceito e documentado: um script injetado na página (XSS) poderia ler o token.
 * Mitigações: o React escapa todo texto exibido, o banco só aceita nomes com lista fechada de
 * caracteres, e a hospedagem da versão Web deve servir uma Content-Security-Policy restritiva.
 */
function browserStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export const authStorage: KeyValueBackend = {
  getItem: async (key) => browserStorage()?.getItem(key) ?? null,
  setItem: async (key, value) => {
    browserStorage()?.setItem(key, value);
  },
  removeItem: async (key) => {
    browserStorage()?.removeItem(key);
  },
};
