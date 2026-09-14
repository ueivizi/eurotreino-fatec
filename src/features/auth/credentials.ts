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

/** O tamanho do código é configurado no Supabase (6 por padrão); aceitamos de 6 a 10 dígitos. */
export function isValidOtp(code: string): boolean {
  return /^\d{6,10}$/.test(code);
}

/** Tempo mínimo entre dois pedidos de código, para não esbarrar no limite de envio de e-mails. */
export const RESEND_COOLDOWN_SECONDS = 60;
