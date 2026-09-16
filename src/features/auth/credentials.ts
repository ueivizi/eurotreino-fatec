/** Entrada com e-mail e senha ou por código enviado ao e-mail (RF001): validação do que se digita. */

export const EMAIL_MAX_LENGTH = 254;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX_LENGTH && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/** Aceita o código colado com espaços ou hífen ("123 456"). */
export function normalizeOtp(input: string): string {
  return input.replace(/[\s-]/g, '');
}

/** Tamanho do código no projeto (`otp_length` em supabase/config.toml). Usado só como dica na tela. */
export const OTP_LENGTH = 8;

/** A validação aceita de 6 a 10 dígitos, para não quebrar se o tamanho mudar no Supabase. */
export function isValidOtp(code: string): boolean {
  return /^\d{6,10}$/.test(code);
}

/** Tempo mínimo entre dois pedidos de código, para não esbarrar no limite de envio de e-mails. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Senha: o mínimo do app é maior que o do Supabase (6) de propósito. O máximo é o do bcrypt usado
 * pelo Auth — acima de 72 bytes o resto seria descartado em silêncio, e a senha valeria menos do
 * que a pessoa pensa. A senha nunca é guardada nem registrada aqui: vai direto para o Supabase.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export type PasswordProblem = 'short' | 'long' | 'common';

/** Senhas que qualquer lista de ataque tenta primeiro; recusadas antes mesmo de sair do aparelho. */
const OBVIOUS_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'senha123',
  'eurotreino',
  'qwertyui',
  'abc12345',
]);

export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'short';
  // O limite do bcrypt é em bytes: acentos e emojis ocupam mais de um.
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'long';
  if (OBVIOUS_PASSWORDS.has(password.toLowerCase())) return 'common';
  return null;
}

export const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  short: `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  long: 'Essa senha é longa demais. Use até 72 caracteres.',
  common: 'Essa senha é fácil de adivinhar. Escolha outra.',
};
