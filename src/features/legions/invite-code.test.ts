import {
  formatInviteCode,
  inviteCodeFromLink,
  inviteLink,
  inviteShareMessage,
  isValidInviteCode,
  normalizeInviteCode,
} from './invite-code';

describe('código de convite', () => {
  it('normaliza o que a pessoa digita ou cola', () => {
    expect(normalizeInviteCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('ab cd ef gh')).toBe('ABCDEFGH');
  });

  it('aceita só o alfabeto sem 0, 1, I e O, com 8 símbolos', () => {
    expect(isValidInviteCode('ABCD2345')).toBe(true);
    for (const code of ['ABCD234', 'ABCD23456', 'ABCD0123', 'ABCDIJKL', 'ABCDOPQR', 'abcd2345', 'ABCD-2345']) {
      expect(isValidInviteCode(code)).toBe(false);
    }
  });

  it('formata em dois grupos, inclusive durante a digitação', () => {
    expect(formatInviteCode('abcd2345')).toBe('ABCD-2345');
    expect(formatInviteCode('ABCDE')).toBe('ABCD-E');
    expect(formatInviteCode('ABC')).toBe('ABC');
    expect(formatInviteCode('ABCD23456789')).toBe('ABCD-2345');
  });

  it('só aceita parâmetro de link que passe na regra', () => {
    expect(inviteCodeFromLink('abcd-2345')).toBe('ABCD2345');
    for (const param of [undefined, null, 42, ['ABCD2345'], 'ABCD', '%E0%A4%A', '../../perfil', 'A'.repeat(17)]) {
      expect(inviteCodeFromLink(param)).toBeNull();
    }
  });

  it('monta o link de convite só com endereço público configurado', () => {
    expect(inviteLink('https://app.eurotreino.com.br', 'ABCD2345')).toBe('https://app.eurotreino.com.br/convite/ABCD-2345');
    expect(inviteLink(null, 'ABCD2345')).toBeNull();
    expect(inviteLink('https://app.eurotreino.com.br', 'ABCD')).toBeNull();
    expect(inviteShareMessage('Legião Fênix', 'ABCD2345')).not.toContain('https://');
    expect(inviteShareMessage('Legião Fênix', 'ABCD2345', 'https://app.eurotreino.com.br')).toContain(
      'https://app.eurotreino.com.br/convite/ABCD-2345',
    );
  });
});
