/**
 * Configuração pública do Supabase, lida das variáveis EXPO_PUBLIC_* (embutidas no app).
 *
 * Só a URL do projeto e a chave publicável podem entrar no app. Uma chave secreta daria acesso
 * total ao banco a qualquer pessoa que abrisse o pacote do app, então é recusada aqui.
 */

export type SupabaseConfigProblem = 'missing' | 'invalid_url' | 'invalid_key' | 'secret_key';

export type SupabaseConfig =
  | { ok: true; url: string; publishableKey: string }
  | { ok: false; problem: SupabaseConfigProblem };

const PROJECT_URL = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
const PUBLISHABLE_KEY = /^sb_publishable_[A-Za-z0-9_-]{16,}$/;
const LEGACY_JWT = /^[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+$/;

/** Papel declarado numa chave JWT antiga (anon ou service_role); `null` se não for uma. */
function legacyKeyRole(key: string): string | null {
  const match = LEGACY_JWT.exec(key);
  if (!match) return null;

  const base64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
  let payload: unknown;
  try {
    payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
  } catch {
    // Conteúdo ilegível: a chave é tratada como inválida logo abaixo (falha fechada).
    return null;
  }

  if (typeof payload !== 'object' || payload === null || !('role' in payload)) return null;
  return typeof payload.role === 'string' ? payload.role : null;
}

export function parseSupabaseConfig(url: string | undefined, key: string | undefined): SupabaseConfig {
  if (!url || !key) return { ok: false, problem: 'missing' };
  if (!PROJECT_URL.test(url)) return { ok: false, problem: 'invalid_url' };
  if (key.startsWith('sb_secret_')) return { ok: false, problem: 'secret_key' };
  if (PUBLISHABLE_KEY.test(key)) return { ok: true, url, publishableKey: key };

  const role = legacyKeyRole(key);
  if (role === 'service_role') return { ok: false, problem: 'secret_key' };
  if (role === 'anon') return { ok: true, url, publishableKey: key };
  return { ok: false, problem: 'invalid_key' };
}
