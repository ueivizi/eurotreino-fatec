import { isValidGroupName, normalizeGroupName } from './group-name';

describe('nome da Legião', () => {
  it('normaliza espaços nas pontas', () => {
    expect(normalizeGroupName('  Legião Fênix ')).toBe('Legião Fênix');
  });

  it('aceita nomes com acento, números e os sinais permitidos', () => {
    for (const name of ['Legião Fênix', 'Turma 6', 'Fé & Força', 'Bora!', "D'Artagnan", 'Os Brabos da Academia']) {
      expect(isValidGroupName(name)).toBe(true);
    }
  });

  it('recusa nomes fora da regra', () => {
    for (const name of ['AB', 'L'.repeat(41), ' Fênix', 'Legião  Fênix', '<script>', '!Legião', 'Legião 💪', 'Legião\nFênix']) {
      expect(isValidGroupName(name)).toBe(false);
    }
  });
});
