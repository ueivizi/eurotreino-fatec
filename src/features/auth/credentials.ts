/** Entrada por código enviado ao e-mail (RF001): validação do que a pessoa digita. */

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
