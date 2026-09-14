import { isEmblemName, type EmblemName } from '@/features/profile/emblems';
import { isIsoDate, isNonEmptyText, isNonNegativeInteger, isRow, isUuid, parseList, singleRow } from '@/lib/parse';

import { isValidInviteCode } from './invite-code';

export type LegionRole = 'owner' | 'member';

export type LegionSummary = {
  id: string;
  name: string;
  emblem: EmblemName;
  role: LegionRole;
  memberCount: number;
  joinedAt: string;
};

export type Invite = { code: string; expiresAt: string };

export type CreatedLegion = { id: string; name: string; emblem: EmblemName; invite: Invite };

export type InvitePreview =
  | { status: 'ok'; name: string; emblem: EmblemName; memberCount: number; isMember: boolean }
  | { status: 'invalid' }
  | { status: 'rate_limited' };

export type JoinResult =
  | { status: 'joined' | 'already_member'; legionId: string; legionName: string }
  | { status: 'group_full' | 'group_limit_reached'; legionName: string }
  | { status: 'invalid' | 'rate_limited' };

export function isLegionRole(value: unknown): value is LegionRole {
  return value === 'owner' || value === 'member';
}

function parseLegionSummary(item: unknown): LegionSummary | null {
  if (!isRow(item)) return null;
  const { group_id: id, name, emblem, role, member_count: memberCount, joined_at: joinedAt } = item;
  if (!isUuid(id) || !isNonEmptyText(name, 40) || typeof emblem !== 'string' || !isEmblemName(emblem)) return null;
  if (!isLegionRole(role) || !isNonNegativeInteger(memberCount) || !isIsoDate(joinedAt)) return null;
  return { id, name, emblem, role, memberCount, joinedAt };
}

export function parseMyLegions(value: unknown): LegionSummary[] | null {
  return parseList(value, parseLegionSummary);
}

function parseInviteRow(row: unknown): Invite | null {
  if (!isRow(row)) return null;
  const { code, expires_at: expiresAt } = row;
  if (typeof code !== 'string' || !isValidInviteCode(code) || !isIsoDate(expiresAt)) return null;
  return { code, expiresAt };
}

export function parseInvite(value: unknown): Invite | null {
  return parseInviteRow(singleRow(value));
}

export function parseCreatedLegion(value: unknown): CreatedLegion | null {
  const row = singleRow(value);
  if (!row) return null;
  const { group_id: id, name, emblem } = row;
  const invite = parseInviteRow({ code: row.invite_code, expires_at: row.invite_expires_at });
  if (!isUuid(id) || !isNonEmptyText(name, 40) || typeof emblem !== 'string' || !isEmblemName(emblem) || !invite) {
    return null;
  }
  return { id, name, emblem, invite };
}

export function parseInvitePreview(value: unknown): InvitePreview | null {
  const row = singleRow(value);
  if (!row) return null;
  if (row.status === 'invalid' || row.status === 'rate_limited') return { status: row.status };
  if (row.status !== 'ok') return null;

  const { group_name: name, group_emblem: emblem, member_count: memberCount, is_member: isMember } = row;
  if (!isNonEmptyText(name, 40) || typeof emblem !== 'string' || !isEmblemName(emblem)) return null;
  if (!isNonNegativeInteger(memberCount) || typeof isMember !== 'boolean') return null;
  return { status: 'ok', name, emblem, memberCount, isMember };
}

export function parseJoinResult(value: unknown): JoinResult | null {
  const row = singleRow(value);
  if (!row) return null;
  const { status, group_id: legionId, group_name: legionName } = row;

  switch (status) {
    case 'joined':
    case 'already_member':
      return isUuid(legionId) && isNonEmptyText(legionName, 40) ? { status, legionId, legionName } : null;
    case 'group_full':
    case 'group_limit_reached':
      return isNonEmptyText(legionName, 40) ? { status, legionName } : null;
    case 'invalid':
    case 'rate_limited':
      return { status };
    default:
      return null;
  }
}
