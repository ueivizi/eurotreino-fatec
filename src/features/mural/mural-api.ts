import {
  DEFAULT_EMBLEM_COLOR,
  isEmblemColor,
  isEmblemName,
  type EmblemColor,
  type EmblemName,
} from '@/features/profile/emblems';
import { isNonEmptyText, isNonNegativeInteger, isRow, isUuid, parseList } from '@/lib/parse';
import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

/**
 * Mural da Legião: conversa entre membros, com moderação.
 *
 * As regras de quem lê o quê moram no banco — aqui o app só mostra o que a RPC devolveu. Uma
 * mensagem retida chega apenas para o fundador e para quem a escreveu, e a contagem de denúncias
 * vem zerada para quem não é o fundador.
 */

export const MESSAGE_MAX_LENGTH = 500;

export type MuralMessage = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  displayName: string;
  emblem: EmblemName;
  emblemColor: EmblemColor;
  isMine: boolean;
  /** Escrita pelo fundador da Legião. */
  isFromOwner: boolean;
  /** Retida por denúncias: só o fundador e quem escreveu recebem essas mensagens. */
  isHeld: boolean;
  /** Quantas denúncias; sempre 0 para quem não é o fundador. */
  reportsCount: number;
};

function parseMessage(item: unknown): MuralMessage | null {
  if (!isRow(item)) return null;
  const { message_id: id, body, created_at: createdAt, author_id: authorId, display_name: displayName, emblem } = item;
  if (!isUuid(id) || !isUuid(authorId) || !isNonEmptyText(body, MESSAGE_MAX_LENGTH)) return null;
  if (!isNonEmptyText(displayName, 32) || typeof emblem !== 'string' || !isEmblemName(emblem)) return null;
  if (typeof createdAt !== 'string') return null;
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return null;

  const { is_mine: isMine, is_owner_message: isFromOwner, is_held: isHeld, reports_count: reportsCount } = item;
  if (typeof isMine !== 'boolean' || typeof isFromOwner !== 'boolean' || typeof isHeld !== 'boolean') return null;
  if (!isNonNegativeInteger(reportsCount)) return null;

  return {
    id,
    body,
    createdAt: at,
    authorId,
    displayName,
    emblem,
    emblemColor: isEmblemColor(item.emblem_color) ? item.emblem_color : DEFAULT_EMBLEM_COLOR,
    isMine,
    isFromOwner,
    isHeld,
    reportsCount,
  };
}

export function parseMural(value: unknown): MuralMessage[] | null {
  return parseList(value, parseMessage);
}

export async function fetchMural(legionId: string): Promise<MuralMessage[]> {
  const { data, error } = await getSupabase().rpc('group_mural', { p_group_id: legionId });
  if (error) throw toApiError(error);
  const messages = parseMural(data);
  if (!messages) throw unexpectedResponse();
  return messages;
}

export async function postMessage(legionId: string, body: string): Promise<void> {
  const { error } = await getSupabase().rpc('post_message', { p_group_id: legionId, p_body: body });
  if (error) throw toApiError(error);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_message', { p_message_id: messageId });
  if (error) throw toApiError(error);
}

export async function reportMessage(messageId: string): Promise<void> {
  const { error } = await getSupabase().rpc('report_message', { p_message_id: messageId });
  if (error) throw toApiError(error);
}

export async function clearMessageReports(messageId: string): Promise<void> {
  const { error } = await getSupabase().rpc('clear_message_reports', { p_message_id: messageId });
  if (error) throw toApiError(error);
}
