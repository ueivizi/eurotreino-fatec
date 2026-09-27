import { RPC_MESSAGES, rpcErrorCode, rpcErrorMessage } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import { DEFAULT_EMBLEM_COLOR, isEmblemColor, isEmblemName, type EmblemColor, type EmblemName } from './emblems';

export type Profile = {
  id: string;
  displayName: string;
  emblem: EmblemName;
  emblemColor: EmblemColor;
  /** Quando a pessoa consentiu em registrar medidas de saúde; `null` = sem consentimento. */
  healthConsentAt: string | null;
  /** Foto de perfil vista pelas Legiões; `null` = sem consentimento. */
  photoConsentAt: string | null;
  /** GPS no treino com o app aberto; `null` = sem consentimento. */
  locationConsentAt: string | null;
  /** Quando a foto foi trocada; `null` = sem foto. */
  avatarUpdatedAt: string | null;
};

function optionalTimestamp(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

/** Resposta do servidor é dado externo: só vira Profile se tiver exatamente o formato esperado. */
export function parseProfileRow(row: unknown): Profile | null {
  if (typeof row !== 'object' || row === null) return null;
  const { id, display_name: displayName, emblem, emblem_color: emblemColor } = row as Record<string, unknown>;
  const { health_consent_at: consent, photo_consent_at: photo, location_consent_at: location, avatar_updated_at: avatar } = row as Record<
    string,
    unknown
  >;
  if (typeof id !== 'string' || typeof displayName !== 'string' || typeof emblem !== 'string') return null;
  if (!isEmblemName(emblem)) return null;
  // Cor desconhecida (app antigo, valor novo no banco) cai no padrão em vez de derrubar o perfil.
  return {
    id,
    displayName,
    emblem,
    emblemColor: isEmblemColor(emblemColor) ? emblemColor : DEFAULT_EMBLEM_COLOR,
    healthConsentAt: optionalTimestamp(consent),
    photoConsentAt: optionalTimestamp(photo),
    locationConsentAt: optionalTimestamp(location),
    // Sem consentimento não há foto, mesmo que a resposta diga outra coisa.
    avatarUpdatedAt: optionalTimestamp(photo) ? optionalTimestamp(avatar) : null,
  };
}

export type ProfileLookup = { kind: 'found'; profile: Profile } | { kind: 'missing' } | { kind: 'error' };

/**
 * Perfil do próprio usuário, com as escolhas de dados. Vem de `my_profile()`: a tabela só deixa ler
 * direto as colunas que a Legião também vê.
 */
export async function fetchOwnProfile(userId: string): Promise<ProfileLookup> {
  const { data, error } = await getSupabase().rpc('my_profile');
  if (error) return { kind: 'error' };
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return { kind: 'missing' };
  const profile = rows.length === 1 ? parseProfileRow(rows[0]) : null;
  return profile && profile.id === userId ? { kind: 'found', profile } : { kind: 'error' };
}

export type SaveProfileResult = { ok: true; profile: Profile } | { ok: false; message: string; code: string | null };

/** RF002: cria ou atualiza o perfil pela função do banco, que valida tudo de novo. */
export async function saveProfile(
  displayName: string,
  emblem: EmblemName,
  emblemColor: EmblemColor,
): Promise<SaveProfileResult> {
  const { data, error } = await getSupabase().rpc('complete_profile', {
    p_display_name: displayName,
    p_emblem: emblem,
    p_emblem_color: emblemColor,
  });

  if (error) return { ok: false, message: rpcErrorMessage(error), code: rpcErrorCode(error) };
  const profile = parseProfileRow(data);
  return profile ? { ok: true, profile } : { ok: false, message: RPC_MESSAGES.generic, code: null };
}
