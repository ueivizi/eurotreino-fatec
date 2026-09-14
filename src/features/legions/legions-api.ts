import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import type { EmblemName } from '@/features/profile/emblems';

import {
  parseCreatedLegion,
  parseInvite,
  parseInvitePreview,
  parseJoinResult,
  parseMyLegions,
  type CreatedLegion,
  type Invite,
  type InvitePreview,
  type JoinResult,
  type LegionSummary,
} from './legions-parsers';

function orUnexpected<T>(value: T | null): T {
  if (value === null) throw unexpectedResponse();
  return value;
}

export async function fetchMyLegions(): Promise<LegionSummary[]> {
  const { data, error } = await getSupabase().rpc('my_groups');
  if (error) throw toApiError(error);
  return orUnexpected(parseMyLegions(data));
}

/** RF003 */
export async function createLegion(name: string, emblem: EmblemName): Promise<CreatedLegion> {
  const { data, error } = await getSupabase().rpc('create_group', { p_name: name, p_emblem: emblem });
  if (error) throw toApiError(error);
  return orUnexpected(parseCreatedLegion(data));
}

/** RF004: convite aberto da Legião (um novo é emitido se o anterior venceu). */
export async function fetchInvite(legionId: string): Promise<Invite> {
  const { data, error } = await getSupabase().rpc('get_group_invite', { p_group_id: legionId });
  if (error) throw toApiError(error);
  return orUnexpected(parseInvite(data));
}

/** RF004: só o fundador; invalida o código anterior. */
export async function regenerateInvite(legionId: string): Promise<Invite> {
  const { data, error } = await getSupabase().rpc('regenerate_invite', { p_group_id: legionId });
  if (error) throw toApiError(error);
  return orUnexpected(parseInvite(data));
}

/** RF005: cada código inválido conta no limite de tentativas, então só é chamado por ação da pessoa. */
export async function previewInvite(code: string): Promise<InvitePreview> {
  const { data, error } = await getSupabase().rpc('preview_invite', { p_code: code });
  if (error) throw toApiError(error);
  return orUnexpected(parseInvitePreview(data));
}

/** RF005 */
export async function joinLegion(code: string): Promise<JoinResult> {
  const { data, error } = await getSupabase().rpc('join_group_by_code', { p_code: code });
  if (error) throw toApiError(error);
  return orUnexpected(parseJoinResult(data));
}

export async function leaveLegion(legionId: string): Promise<void> {
  const { error } = await getSupabase().rpc('leave_group', { p_group_id: legionId });
  if (error) throw toApiError(error);
}
