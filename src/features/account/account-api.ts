import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { isRow } from '@/lib/parse';
import { toApiError } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

export type DeleteAccountResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'reauthentication_required' | 'not_authenticated' | 'network' | 'failed';
      /** Referência curta para suporte (status e código do servidor). Nunca traz token nem e-mail. */
      reference: string;
    };

/**
 * Endereço de retorno que só marca o pedido de código como exclusão de conta: o modelo de e-mail
 * troca o texto quando o recebe. Precisa estar em `additional_redirect_urls` no config.toml.
 */
export const ACCOUNT_DELETION_REDIRECT = 'eurotreino://excluir-conta';

/** Corpo de erro da função delete-account: só os códigos combinados viram motivo conhecido. */
export function deletionFailureReason(body: unknown): 'reauthentication_required' | 'not_authenticated' | 'failed' {
  if (!isRow(body)) return 'failed';
  return body.error === 'reauthentication_required' || body.error === 'not_authenticated' ? body.error : 'failed';
}

async function readJson(response: unknown): Promise<unknown> {
  if (typeof response !== 'object' || response === null || !('json' in response)) return null;
  try {
    return await (response as Response).json();
  } catch {
    return null;
  }
}

/** RF011: pede ao servidor a exclusão da própria conta (exige confirmação recente por código). */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { error } = await getSupabase().functions.invoke('delete-account', { method: 'POST' });
  if (!error) return { ok: true };
  if (error instanceof FunctionsHttpError) {
    const body = await readJson(error.context);
    return { ok: false, reason: deletionFailureReason(body), reference: deletionReference(error.context, body) };
  }
  if (error instanceof FunctionsRelayError) return { ok: false, reason: 'network', reference: 'relay' };
  if (error instanceof FunctionsFetchError) return { ok: false, reason: 'network', reference: 'fetch' };
  return { ok: false, reason: 'failed', reference: 'desconhecido' };
}

/** "401 not_authenticated", "500 delete_failed"…: só status e códigos de lista fechada. */
export function deletionReference(response: unknown, body: unknown): string {
  const status =
    typeof response === 'object' && response !== null && 'status' in response && typeof response.status === 'number'
      ? String(response.status)
      : 'http';
  const code = isRow(body) && typeof body.error === 'string' && /^[a-z_]{1,40}$/.test(body.error)
    ? body.error
    : isRow(body) && typeof body.code === 'string' && /^[A-Z_]{1,60}$/.test(body.code)
      ? body.code
      : null;
  return code ? `${status} ${code}` : status;
}

/**
 * Consentimento específico para medidas de saúde (LGPD art. 11, I). Desligar apaga, no servidor e
 * na mesma transação, todas as frequências cardíacas já guardadas.
 */
export async function setHealthConsent(granted: boolean): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('set_health_consent', { p_granted: granted });
  if (error) throw toApiError(error);
  return typeof data === 'string' ? data : null;
}

/** Escolhas de dados além da saúde: foto de perfil e GPS no treino. */
export type DataPurpose = 'foto' | 'localizacao';

export async function setDataConsent(purpose: DataPurpose, granted: boolean): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('set_data_consent', { p_purpose: purpose, p_granted: granted });
  if (error) throw toApiError(error);
  return typeof data === 'string' ? data : null;
}
