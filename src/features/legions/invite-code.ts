/**
 * Código de convite (RF004/RF005): 8 símbolos de um alfabeto sem 0, 1, I e O, exibido como XXXX-XXXX.
 * Mesma regra do banco (private.group_invites); a validação local só evita pedidos inúteis.
 */

export const INVITE_CODE_LENGTH = 8;

const INVITE_CODE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

/** Maiúsculas, sem espaços nem hífens; entradas longas são cortadas (o campo aceita no máximo 9). */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').slice(0, 16);
}

export function isValidInviteCode(code: string): boolean {
  return INVITE_CODE.test(code);
}

/** "ABCDEFGH" → "ABCD-EFGH"; enquanto digita, "ABCDE" → "ABCD-E". */
export function formatInviteCode(code: string): string {
  const clean = normalizeInviteCode(code).slice(0, INVITE_CODE_LENGTH);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** Parâmetro de link de convite: só vira código se passar na regra; caso contrário, `null`. */
export function inviteCodeFromLink(param: unknown): string | null {
  if (typeof param !== 'string' || param.length > 16) return null;
  const code = normalizeInviteCode(param);
  return isValidInviteCode(code) ? code : null;
}

/** Link que abre a entrada na Legião; `null` enquanto a versão Web não tiver endereço público. */
export function inviteLink(appUrl: string | null, code: string): string | null {
  return appUrl && isValidInviteCode(code) ? `${appUrl}/convite/${formatInviteCode(code)}` : null;
}

export function inviteShareMessage(legionName: string, code: string, appUrl: string | null = null): string {
  const formatted = formatInviteCode(code);
  const link = inviteLink(appUrl, code);
  return link
    ? `Entre na minha Legião "${legionName}" no EuroTreino: ${link}\nSe preferir, toque em Legião › Entrar com código e use: ${formatted}`
    : `Entre na minha Legião "${legionName}" no EuroTreino. No app, toque em Legião › Entrar com código e use: ${formatted}`;
}
