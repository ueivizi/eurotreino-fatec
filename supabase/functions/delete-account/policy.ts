// Regras da exclusão de conta (RF011), sem dependências: rodam no Deno (Edge Function) e nos
// testes do Node. Excluir é irreversível, então exige que a pessoa tenha confirmado a identidade
// há pouco tempo (código recebido no e-mail), e não só uma sessão aberta no aparelho.

/** Janela, em segundos, entre a confirmação por código e o pedido de exclusão. */
export const REAUTHENTICATION_WINDOW_SECONDS = 10 * 60;

/** Tolerância para relógios levemente adiantados entre servidores. */
const CLOCK_SKEW_SECONDS = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;
const MAX_AUTHORIZATION_LENGTH = 4096;

export type DeletionDecision =
  | { allowed: true; userId: string }
  | { allowed: false; status: 401; error: 'not_authenticated' }
  | { allowed: false; status: 403; error: 'reauthentication_required' };

/** Token do cabeçalho Authorization, só se tiver o formato de um JWT. */
export function bearerToken(header: string | null): string | null {
  if (header === null || header.length > MAX_AUTHORIZATION_LENGTH) return null;
  return BEARER.exec(header)?.[1] ?? null;
}

/** Usuário autenticado (não anônimo) dono do token; `null` em qualquer outro caso. */
export function authenticatedUserId(claims: unknown): string | null {
  if (typeof claims !== 'object' || claims === null) return null;
  const { sub, role, is_anonymous: isAnonymous } = claims as Record<string, unknown>;
  if (typeof sub !== 'string' || !UUID.test(sub) || role !== 'authenticated' || isAnonymous === true) return null;
  return sub;
}

/** Instante mais recente (em segundos) em que a pessoa provou a identidade nesta sessão. */
export function latestAuthenticationAt(claims: unknown): number | null {
  if (typeof claims !== 'object' || claims === null) return null;
  const { amr } = claims as Record<string, unknown>;
  if (!Array.isArray(amr)) return null;

  let latest: number | null = null;
  for (const entry of amr) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { timestamp } = entry as Record<string, unknown>;
    if (typeof timestamp === 'number' && Number.isFinite(timestamp) && (latest === null || timestamp > latest)) {
      latest = timestamp;
    }
  }
  return latest;
}

/**
 * Decide se a exclusão pode seguir. `authenticatedAt` vem do token (amr) ou, quando o token não
 * traz horário, do último login registrado no Auth. Sem horário confiável, a resposta é não.
 */
export function decideDeletion(claims: unknown, authenticatedAt: number | null, nowSeconds: number): DeletionDecision {
  const userId = authenticatedUserId(claims);
  if (userId === null) return { allowed: false, status: 401, error: 'not_authenticated' };

  const recent =
    authenticatedAt !== null &&
    authenticatedAt <= nowSeconds + CLOCK_SKEW_SECONDS &&
    nowSeconds - authenticatedAt <= REAUTHENTICATION_WINDOW_SECONDS;
  if (!recent) return { allowed: false, status: 403, error: 'reauthentication_required' };

  return { allowed: true, userId };
}

/** Chave secreta do projeto: a nova (SUPABASE_SECRET_KEYS, JSON) ou a antiga (service_role). */
export function projectSecretKey(secretKeysJson: string | undefined, legacyServiceRoleKey: string | undefined): string | null {
  if (secretKeysJson) {
    try {
      const parsed: unknown = JSON.parse(secretKeysJson);
      if (typeof parsed === 'object' && parsed !== null) {
        const key = (parsed as Record<string, unknown>).default;
        if (typeof key === 'string' && key.length > 0) return key;
      }
    } catch {
      // Valor malformado: tenta a chave antiga abaixo e, sem ela, a função recusa o pedido.
    }
  }
  return legacyServiceRoleKey && legacyServiceRoleKey.length > 0 ? legacyServiceRoleKey : null;
}

/** Origens da versão Web que podem chamar a função pelo navegador (os apps nativos não usam CORS). */
export const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:8081';

export function corsHeadersFor(origin: string | null, allowedOrigins: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const allowed = (allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== '*');
  if (origin !== null && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
