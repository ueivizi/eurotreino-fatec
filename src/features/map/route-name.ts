/**
 * Nome de rota compartilhada com a Legião: mesma regra do banco (private.is_valid_route_name). O
 * teste de sincronia do banco compara as duas com os mesmos exemplos.
 */
export const ROUTE_SHARE_NAME_MAX = 40;

const LETTER_OR_DIGIT = 'A-Za-zÀ-ÖØ-öø-ÿ0-9';
const ROUTE_NAME = new RegExp(`^[${LETTER_OR_DIGIT}]([${LETTER_OR_DIGIT} .,'()/-]*[${LETTER_OR_DIGIT}.)])?$`);

export function isValidRouteName(name: string): boolean {
  const length = Array.from(name).length;
  return length >= 2 && length <= ROUTE_SHARE_NAME_MAX && name === name.normalize('NFC') && ROUTE_NAME.test(name) && !name.includes('  ');
}

/**
 * Nome guardado no aparelho (livre) no formato que a Legião aceita: tira o que não cabe na regra.
 * Se não sobrar nome válido, usa o de reserva.
 */
export function shareableRouteName(name: string, fallback: string): string {
  const cleaned = name
    .normalize('NFC')
    .replace(new RegExp(`[^${LETTER_OR_DIGIT} .,'()/-]`, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(new RegExp(`^[^${LETTER_OR_DIGIT}]+`), '')
    .slice(0, ROUTE_SHARE_NAME_MAX)
    .replace(new RegExp(`[^${LETTER_OR_DIGIT}.)]+$`), '');
  return isValidRouteName(cleaned) ? cleaned : fallback;
}
