import { isLegionRole, type LegionRole } from '@/features/legions/legions-parsers';
import {
  DEFAULT_EMBLEM_COLOR,
  isEmblemColor,
  isEmblemName,
  type EmblemColor,
  type EmblemName,
} from '@/features/profile/emblems';
import { isIsoDate, isNonEmptyText, isNonNegativeInteger, isRow, isUuid, parseList } from '@/lib/parse';

import { isTrophyKind, SEASON_WEEKS, type TrophyKind } from './louros';

export type SeasonEntry = {
  userId: string;
  displayName: string;
  emblem: EmblemName;
  emblemColor: EmblemColor;
  role: LegionRole;
  louros: number;
  /** Louros da última semana fechada: sobe (+) ou desce (-). */
  lastDelta: number;
  weeksCounted: number;
  weeksMet: number;
  podiums: number;
  seasonGlory: number;
  /** Treinos pontuados na semana corrente (só na temporada corrente). */
  weekScored: number;
  place: number;
  isMe: boolean;
};

export type SeasonTable = {
  seasonStart: string;
  /** 0: ainda não começou; 1 a 4: semana corrente da temporada. */
  seasonWeek: number;
  weeklyMinimum: number;
  entries: SeasonEntry[];
};

export type Trophy = {
  kind: TrophyKind;
  /** Nulo quando o Triunfo saiu numa Legião que quem vê não divide. */
  groupName: string | null;
  seasonStart: string;
  louros: number;
  /** Quando saiu (só no perfil; a apuração não devolve). */
  awardedAt: string | null;
};

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function parseSeasonRow(item: unknown): (SeasonEntry & { seasonStart: string; seasonWeek: number; weeklyMinimum: number }) | null {
  if (!isRow(item)) return null;
  const { user_id: userId, display_name: displayName, emblem, role, louros, last_delta: lastDelta } = item;
  const { weeks_counted: weeksCounted, weeks_met: weeksMet, podiums, season_glory: seasonGlory } = item;
  const { week_scored: weekScored, place, is_me: isMe, season_start: seasonStart } = item;
  const { season_week: seasonWeek, weekly_minimum: weeklyMinimum } = item;
  const emblemColor = item.emblem_color === null || item.emblem_color === undefined ? DEFAULT_EMBLEM_COLOR : item.emblem_color;

  if (!isUuid(userId) || !isNonEmptyText(displayName, 40) || typeof emblem !== 'string' || !isEmblemName(emblem)) return null;
  if (!isEmblemColor(emblemColor) || !isLegionRole(role)) return null;
  if (![louros, weeksCounted, weeksMet, podiums, seasonGlory, weekScored].every(isNonNegativeInteger)) return null;
  if (!isInteger(lastDelta) || !isNonNegativeInteger(place) || place < 1 || typeof isMe !== 'boolean') return null;
  if (!isIsoDate(seasonStart) || !isNonNegativeInteger(seasonWeek) || seasonWeek > SEASON_WEEKS) return null;
  if (!isNonNegativeInteger(weeklyMinimum) || weeklyMinimum < 2 || weeklyMinimum > 4) return null;
  if ((weeksMet as number) > (weeksCounted as number) || (weeksCounted as number) > SEASON_WEEKS) return null;

  return {
    userId,
    displayName,
    emblem,
    emblemColor,
    role,
    louros: louros as number,
    lastDelta,
    weeksCounted: weeksCounted as number,
    weeksMet: weeksMet as number,
    podiums: podiums as number,
    seasonGlory: seasonGlory as number,
    weekScored: weekScored as number,
    place,
    isMe,
    seasonStart,
    seasonWeek,
    weeklyMinimum,
  };
}

/** Tabela vazia é válida (temporada anterior que não existe); linhas incoerentes derrubam a resposta. */
export function parseSeasonTable(value: unknown): SeasonTable | null {
  const rows = parseList(value, parseSeasonRow);
  if (!rows) return null;
  const first = rows[0];
  if (!first) return { seasonStart: '', seasonWeek: 0, weeklyMinimum: 0, entries: [] };
  if (rows.some((row) => row.seasonStart !== first.seasonStart)) return null;
  return {
    seasonStart: first.seasonStart,
    seasonWeek: first.seasonWeek,
    weeklyMinimum: first.weeklyMinimum,
    entries: rows.map(({ seasonStart: _s, seasonWeek: _w, weeklyMinimum: _m, ...entry }) => entry),
  };
}

function parseTrophy(item: unknown): Trophy | null {
  if (!isRow(item)) return null;
  const { kind, group_name: groupName, season_start: seasonStart, louros, awarded_at: awardedAt } = item;
  if (!isTrophyKind(kind) || !isIsoDate(seasonStart) || !isNonNegativeInteger(louros)) return null;
  if (groupName !== null && !isNonEmptyText(groupName, 40)) return null;
  if (awardedAt !== undefined && awardedAt !== null && !isIsoDate(awardedAt)) return null;
  return { kind, groupName, seasonStart, louros, awardedAt: typeof awardedAt === 'string' ? awardedAt : null };
}

export function parseTrophies(value: unknown): Trophy[] | null {
  return parseList(value, parseTrophy);
}
