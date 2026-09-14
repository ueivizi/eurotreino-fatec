import { isValidDisplayName, normalizeDisplayName } from './display-name';

/** "Téo" com o acento decomposto (e + acento agudo combinante), como alguns teclados enviam. */
const DECOMPOSED_TEO = `Te${String.fromCharCode(0x301)}o`;

describe('nome de exibição', () => {
  it('normaliza espaços nas pontas e acentos decompostos', () => {
    expect(normalizeDisplayName(`  ${DECOMPOSED_TEO}  `)).toBe('Téo');
  });

  it('aceita nomes com acento, apóstrofo, hífen e ponto', () => {
    for (const name of ['Lu', 'Digão', "D'Ávila", 'Ana-Clara', 'Jr.', 'Camila Souza', 'Rafa 2']) {
      expect(isValidDisplayName(name)).toBe(true);
    }
  });

  it('recusa nomes fora da regra', () => {
    for (const name of ['A', 'a'.repeat(33), ' Ana', 'Ana ', 'Ana  Clara', '<b>Ana</b>', 'Ana 💪', '-Ana', "Ana'", 'Ana\nClara']) {
      expect(isValidDisplayName(name)).toBe(false);
    }
  });

  it('recusa texto não normalizado', () => {
    expect(isValidDisplayName(DECOMPOSED_TEO)).toBe(false);
  });
});
