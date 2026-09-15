/**
 * Endereço público da versão Web (EXPO_PUBLIC_APP_URL), usado para montar links de convite
 * clicáveis. Só aceita a origem https, sem caminho, usuário, consulta ou fragmento; qualquer outro
 * valor desliga os links e o convite segue só com o código.
 */
const ORIGIN = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?::\d{2,5})?\/?$/;

export function parseAppUrl(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return ORIGIN.test(trimmed) ? trimmed.replace(/\/$/, '') : null;
}

export const appUrl = parseAppUrl(process.env.EXPO_PUBLIC_APP_URL);
