import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { isRow } from '@/lib/parse';
import { getSupabase } from '@/lib/supabase';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: 'reauthentication_required' | 'not_authenticated' | 'network' | 'failed' };

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
  if (error instanceof FunctionsHttpError) return { ok: false, reason: deletionFailureReason(await readJson(error.context)) };
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) return { ok: false, reason: 'network' };
  return { ok: false, reason: 'failed' };
}
