import { isEmblemColor, isEmblemName, type EmblemColor, type EmblemName } from '@/features/profile/emblems';
import { isIsoDate, isNonEmptyText, isNonNegativeInteger, isRow, isUuid, parseList, singleRow } from '@/lib/parse';

import { isValidInviteCode } from './invite-code';

export type LegionRole = 'owner' | 'member';

/** clássica: Coliseu semanal, ninguém perde nada. competitiva: temporadas com Louros que caem. */
export type LegionMode = 'classica' | 'competitiva';

export const WEEKLY_MINIMUMS = [2, 3, 4] as const;

/** Estandarte e modo, como o banco guarda. */
export type LegionStyle = {
  emblem: EmblemName;
  bannerColor: EmblemColor;
  mode: LegionMode;
  /** Treinos pontuados por semana para não perder Louros; só na competitiva. */
  weeklyMinimum: number | null;
  /** Segunda-feira em que a primeira temporada começa a contar; só na competitiva. */
  modeSince: string | null;
};

export type LegionSummary = LegionStyle & {
  id: string;
  name: string;
  role: LegionRole;
  memberCount: number;
  joinedAt: string;
};

export type Invite = { code: string; expiresAt: string };

export type CreatedLegion = LegionStyle & { id: string; name: string; invite: Invite };

export type InvitePreview =
  | ({ status: 'ok'; name: string; memberCount: number; isMember: boolean } & Omit<LegionStyle, 'modeSince'>)
  | { status: 'invalid' }
  | { status: 'rate_limited' };

export type JoinResult =
  | { status: 'joined' | 'already_member'; legionId: string; legionName: string }
  | { status: 'group_full' | 'group_limit_reached'; legionName: string }
  | { status: 'invalid' | 'rate_limited' };

export function isLegionRole(value: unknown): value is LegionRole {
  return value === 'owner' || value === 'member';
}

export function isLegionMode(value: unknown): value is LegionMode {
  return value === 'classica' || value === 'competitiva';
}

/** Estandarte e modo coerentes: competitiva sempre com mínimo de 2 a 4 e data de início. */
function parseStyle(row: Record<string, unknown>, withSince: boolean): LegionStyle | null {
  const { emblem, banner_color: bannerColor, mode, weekly_minimum: weeklyMinimum } = row;
  const modeSince = withSince ? row.mode_since : null;
  if (typeof emblem !== 'string' || !isEmblemName(emblem)) return null;
  if (typeof bannerColor !== 'string' || !isEmblemColor(bannerColor) || !isLegionMode(mode)) return null;
  if (mode === 'classica') {
    return weeklyMinimum === null && (modeSince === null || modeSince === undefined)
      ? { emblem, bannerColor, mode, weeklyMinimum: null, modeSince: null }
      : null;
  }
  if (typeof weeklyMinimum !== 'number' || !(WEEKLY_MINIMUMS as readonly number[]).includes(weeklyMinimum)) return null;
  if (withSince && !isIsoDate(modeSince)) return null;
  return { emblem, bannerColor, mode, weeklyMinimum, modeSince: withSince ? (modeSince as string) : null };
}

function parseLegionSummary(item: unknown): LegionSummary | null {
  if (!isRow(item)) return null;
  const { group_id: id, name, role, member_count: memberCount, joined_at: joinedAt } = item;
  const style = parseStyle(item, true);
  if (!isUuid(id) || !isNonEmptyText(name, 40) || !style) return null;
  if (!isLegionRole(role) || !isNonNegativeInteger(memberCount) || !isIsoDate(joinedAt)) return null;
  return { id, name, role, memberCount, joinedAt, ...style };
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
  const { group_id: id, name } = row;
  const invite = parseInviteRow({ code: row.invite_code, expires_at: row.invite_expires_at });
  const style = parseStyle(row, true);
  if (!isUuid(id) || !isNonEmptyText(name, 40) || !style || !invite) return null;
  return { id, name, invite, ...style };
}

export function parseInvitePreview(value: unknown): InvitePreview | null {
  const row = singleRow(value);
  if (!row) return null;
  if (row.status === 'invalid' || row.status === 'rate_limited') return { status: row.status };
  if (row.status !== 'ok') return null;

  const { group_name: name, member_count: memberCount, is_member: isMember } = row;
  const style = parseStyle({ ...row, emblem: row.group_emblem }, false);
  if (!isNonEmptyText(name, 40) || !style) return null;
  if (!isNonNegativeInteger(memberCount) || typeof isMember !== 'boolean') return null;
  const { emblem, bannerColor, mode, weeklyMinimum } = style;
  return { status: 'ok', name, memberCount, isMember, emblem, bannerColor, mode, weeklyMinimum };
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
