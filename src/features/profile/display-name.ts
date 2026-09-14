/**
 * Nome de exibição (RF002): mesma regra do banco (private.is_valid_display_name).
 * O teste de sincronia do banco compara as duas implementações com os mesmos exemplos.
 */

export const DISPLAY_NAME_MAX_LENGTH = 32;

const LETTER_OR_DIGIT = 'A-Za-zÀ-ÖØ-öø-ÿ0-9';
const DISPLAY_NAME = new RegExp(`^[${LETTER_OR_DIGIT}]([${LETTER_OR_DIGIT} .'-]*[${LETTER_OR_DIGIT}.])?$`);

export function normalizeDisplayName(input: string): string {
  return input.trim().normalize('NFC');
}

export function isValidDisplayName(name: string): boolean {
  const length = Array.from(name).length;
  return (
    length >= 2 &&
    length <= DISPLAY_NAME_MAX_LENGTH &&
    name === name.normalize('NFC') &&
    DISPLAY_NAME.test(name) &&
    !name.includes('  ')
  );
}
