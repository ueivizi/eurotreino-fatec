/**
 * Nome da Legião (RF003): mesma regra do banco (private.is_valid_group_name).
 * O teste de sincronia do banco compara as duas implementações com os mesmos exemplos.
 */

export const GROUP_NAME_MAX_LENGTH = 40;

const LETTER_OR_DIGIT = 'A-Za-zÀ-ÖØ-öø-ÿ0-9';
const GROUP_NAME = new RegExp(`^[${LETTER_OR_DIGIT}]([${LETTER_OR_DIGIT} .'&!-]*[${LETTER_OR_DIGIT}.!])?$`);

export function normalizeGroupName(input: string): string {
  return input.trim().normalize('NFC');
}

export function isValidGroupName(name: string): boolean {
  const length = Array.from(name).length;
  return (
    length >= 3 &&
    length <= GROUP_NAME_MAX_LENGTH &&
    name === name.normalize('NFC') &&
    GROUP_NAME.test(name) &&
    !name.includes('  ')
  );
}
