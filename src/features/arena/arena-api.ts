import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import { parseWeeklyRanking, type WeeklyRanking } from './arena-parsers';

/** RF008: semana corrente (0) ou anterior (-1). */
export async function fetchWeeklyRanking(legionId: string, weekOffset: 0 | -1): Promise<WeeklyRanking> {
  const { data, error } = await getSupabase().rpc('group_weekly_ranking', {
    p_group_id: legionId,
    p_week_offset: weekOffset,
  });
  if (error) throw toApiError(error);
  const ranking = parseWeeklyRanking(data);
  if (!ranking) throw unexpectedResponse();
  return ranking;
}
