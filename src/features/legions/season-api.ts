import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

import { parseSeasonTable, parseTrophies, type SeasonTable, type Trophy } from './season-parsers';

/** Tabela da temporada competitiva: corrente (0) ou anterior (-1). */
export async function fetchSeasonTable(legionId: string, seasonOffset: 0 | -1): Promise<SeasonTable> {
  const { data, error } = await getSupabase().rpc('group_season_table', {
    p_group_id: legionId,
    p_season_offset: seasonOffset,
  });
  if (error) throw toApiError(error);
  const table = parseSeasonTable(data);
  if (!table) throw unexpectedResponse();
  return table;
}

/** Apura temporadas encerradas; devolve os Triunfos que a própria pessoa ganhou nesta chamada. */
export async function settleSeasons(legionId: string): Promise<Trophy[]> {
  const { data, error } = await getSupabase().rpc('settle_group_seasons', { p_group_id: legionId });
  if (error) throw toApiError(error);
  const trophies = parseTrophies(data);
  if (!trophies) throw unexpectedResponse();
  return trophies;
}

/** Triunfos do próprio perfil (sem id) ou de quem divide uma Legião com a pessoa. */
export async function fetchTrophies(userId?: string): Promise<Trophy[]> {
  const { data, error } = await getSupabase().rpc('profile_trophies', userId ? { p_user_id: userId } : {});
  if (error) throw toApiError(error);
  const trophies = parseTrophies(data);
  if (!trophies) throw unexpectedResponse();
  return trophies;
}
