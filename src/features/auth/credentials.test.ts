import {
  OTP_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  digitsForCode,
  isValidEmail,
  isValidOtp,
  normalizeEmail,
  normalizeOtp,
  passwordProblem,
} from './credentials';

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

describe('um dígito por quadrado', () => {
  it('guarda só dígitos', () => {
    expect(digitsForCode('4a8b2c', OTP_LENGTH)).toBe('482');
  });

  it('aceita o código colado com espaço e hífen', () => {
    expect(digitsForCode('482 915-77', OTP_LENGTH)).toBe('48291577');
  });

  it('aproveita o código no meio do texto do e-mail', () => {
    expect(digitsForCode('Seu código é 48291577, válido por 1 hora', OTP_LENGTH)).toBe('48291577');
  });

  it('não passa do tamanho do campo', () => {
    expect(digitsForCode('1234567890123', OTP_LENGTH)).toBe('12345678');
  });

  it('acompanha um tamanho menor, se o Supabase mudar', () => {
    expect(digitsForCode('123456789', 6)).toBe('123456');
  });

  it('devolve vazio quando não há dígito', () => {
    expect(digitsForCode('', OTP_LENGTH)).toBe('');
    expect(digitsForCode('colei o e-mail inteiro sem número', OTP_LENGTH)).toBe('');
  });

  /* O campo desenha OTP_LENGTH quadrados, mas a validação aceita de 6 a 10 dígitos: um código mais
     curto tem de continuar passando, senão uma mudança no Supabase trancaria a entrada. */
  it('deixa passar código mais curto que o campo', () => {
    const codigo = digitsForCode('482915', OTP_LENGTH);
    expect(codigo).toBe('482915');
    expect(isValidOtp(codigo)).toBe(true);
  });
});

describe('senha', () => {
  it('aceita uma senha comum de tamanho razoável', () => {
    expect(passwordProblem('coliseu-2026')).toBeNull();
  });

  it('recusa senha curta', () => {
    expect(passwordProblem('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe('short');
    expect(passwordProblem('a'.repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it('mede o limite do bcrypt em bytes, não em caracteres', () => {
    // 71 caracteres acentuados passam de 72 bytes, e o resto seria descartado em silêncio.
    expect(passwordProblem('á'.repeat(PASSWORD_MAX_BYTES - 1))).toBe('long');
    expect(passwordProblem('a'.repeat(PASSWORD_MAX_BYTES))).toBeNull();
    expect(passwordProblem('a'.repeat(PASSWORD_MAX_BYTES + 1))).toBe('long');
  });

  it('recusa as senhas que qualquer ataque tenta primeiro, em qualquer caixa', () => {
    for (const password of ['12345678', 'password', 'EuroTreino', 'Senha123']) {
      expect(passwordProblem(password)).toBe('common');
    }
  });
});
