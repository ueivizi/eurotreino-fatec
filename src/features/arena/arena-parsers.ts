import { isLegionRole, type LegionRole } from '@/features/legions/legions-parsers';
import {
  DEFAULT_EMBLEM_COLOR,
  isEmblemColor,
  isEmblemName,
  type EmblemColor,
  type EmblemName,
} from '@/features/profile/emblems';
import { isIsoDate, isNonEmptyText, isNonNegativeInteger, isRow, isUuid, parseList } from '@/lib/parse';

export type RankingEntry = {
  userId: string;
  displayName: string;
  emblem: EmblemName;
  emblemColor: EmblemColor;
  role: LegionRole;
  weekGlory: number;
  totalGlory: number;
  /** Posição com empates divididos (1, 2, 2, 4). */
  place: number;
  isMe: boolean;
};

export type WeeklyRanking = {
  /** Segunda-feira da semana (America/Sao_Paulo), no formato AAAA-MM-DD. */
  weekStart: string | null;
  entries: RankingEntry[];
};

function parseEntry(item: unknown): (RankingEntry & { weekStart: string }) | null {
  if (!isRow(item)) return null;
  const { user_id: userId, display_name: displayName, emblem, role, week_glory: weekGlory } = item;
  const emblemColor = isEmblemColor(item.emblem_color) ? item.emblem_color : DEFAULT_EMBLEM_COLOR;
  const { total_glory: totalGlory, place, is_me: isMe, week_start: weekStart } = item;
  if (!isUuid(userId) || !isNonEmptyText(displayName, 32) || typeof emblem !== 'string' || !isEmblemName(emblem)) {
    return null;
  }
  if (!isLegionRole(role) || !isNonNegativeInteger(weekGlory) || !isNonNegativeInteger(totalGlory)) return null;
  if (!isNonNegativeInteger(place) || place < 1 || typeof isMe !== 'boolean' || !isIsoDate(weekStart)) return null;
  return { userId, displayName, emblem, emblemColor, role, weekGlory, totalGlory, place, isMe, weekStart };
}

export function parseWeeklyRanking(value: unknown): WeeklyRanking | null {
  const rows = parseList(value, parseEntry);
  if (!rows) return null;
  const weekStart = rows[0]?.weekStart ?? null;
  if (rows.some((row) => row.weekStart !== weekStart)) return null;
  return { weekStart, entries: rows.map(({ weekStart: _week, ...entry }) => entry) };
}
