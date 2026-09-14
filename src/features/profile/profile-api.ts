import { RPC_MESSAGES, rpcErrorCode, rpcErrorMessage } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import { isEmblemName, type EmblemName } from './emblems';

export type Profile = {
  id: string;
  displayName: string;
  emblem: EmblemName;
};

/** Resposta do servidor é dado externo: só vira Profile se tiver exatamente o formato esperado. */
export function parseProfileRow(row: unknown): Profile | null {
  if (typeof row !== 'object' || row === null) return null;
  const { id, display_name: displayName, emblem } = row as Record<string, unknown>;
  if (typeof id !== 'string' || typeof displayName !== 'string' || typeof emblem !== 'string') return null;
  if (!isEmblemName(emblem)) return null;
  return { id, displayName, emblem };
}

export type ProfileLookup = { kind: 'found'; profile: Profile } | { kind: 'missing' } | { kind: 'error' };

/** Perfil do próprio usuário, lido pela política de RLS. */
export async function fetchOwnProfile(userId: string): Promise<ProfileLookup> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, display_name, emblem')
    .eq('id', userId)
    .maybeSingle();

  if (error) return { kind: 'error' };
  if (data === null) return { kind: 'missing' };
  const profile = parseProfileRow(data);
  return profile ? { kind: 'found', profile } : { kind: 'error' };
}

export type SaveProfileResult = { ok: true; profile: Profile } | { ok: false; message: string; code: string | null };

/** RF002: cria ou atualiza o perfil pela função do banco, que valida tudo de novo. */
export async function saveProfile(displayName: string, emblem: EmblemName): Promise<SaveProfileResult> {
  const { data, error } = await getSupabase().rpc('complete_profile', {
    p_display_name: displayName,
    p_emblem: emblem,
  });

  if (error) return { ok: false, message: rpcErrorMessage(error), code: rpcErrorCode(error) };
  const profile = parseProfileRow(data);
  return profile ? { ok: true, profile } : { ok: false, message: RPC_MESSAGES.generic, code: null };
}
