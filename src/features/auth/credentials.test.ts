import { isValidEmail, isValidOtp, normalizeEmail, normalizeOtp } from './credentials';

describe('e-mail', () => {
  it('normaliza espaços e maiúsculas', () => {
    expect(normalizeEmail('  Camila.Souza@Exemplo.COM ')).toBe('camila.souza@exemplo.com');
  });

  it('aceita endereços comuns', () => {
    for (const email of ['lucas@exemplo.com', 'camila.souza+treino@empresa.com.br', 'a@b.co']) {
      expect(isValidEmail(email)).toBe(true);
    }
  });

  it('recusa endereços malformados', () => {
    for (const email of ['', 'lucas', 'lucas@', '@exemplo.com', 'lucas@exemplo', 'lu cas@exemplo.com', 'a@b..com', 'a@@b.com']) {
      expect(isValidEmail(email)).toBe(false);
    }
  });

  it('recusa endereços longos demais', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@b.co`)).toBe(false);
  });
});

describe('código de acesso', () => {
  it('aceita código colado com espaço ou hífen', () => {
    expect(normalizeOtp(' 123 456 ')).toBe('123456');
    expect(normalizeOtp('123-456')).toBe('123456');
  });

  it('aceita de 6 a 10 dígitos e nada além de dígitos', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp('1234567890')).toBe(true);
    for (const code of ['12345', '12345678901', '12345a', '１２３４５６', '']) {
      expect(isValidOtp(code)).toBe(false);
    }
  });
});
