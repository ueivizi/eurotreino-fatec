/**
 * Mensagens em português para os erros do Supabase Auth. Nunca exibimos a mensagem original:
 * ela é técnica, em inglês, e pode revelar detalhes da configuração.
 */

export const AUTH_MESSAGES = {
  network: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
  rateLimited: 'Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.',
  invalidCode: 'Código incorreto ou vencido. Confira o e-mail ou peça um código novo.',
  invalidEmail: 'Confira o endereço de e-mail.',
  notAuthorized: 'Este e-mail ainda não pode receber códigos: durante os testes, o envio é liberado só para e-mails autorizados.',
  unavailable: 'A entrada por e-mail está indisponível no momento.',
  generic: 'Não foi possível concluir agora. Tente de novo em instantes.',
} as const;

export function authErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return AUTH_MESSAGES.generic;
  const { name, code, status } = error as { name?: unknown; code?: unknown; status?: unknown };

  if (name === 'AuthRetryableFetchError' || status === 0) return AUTH_MESSAGES.network;

  switch (code) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return AUTH_MESSAGES.rateLimited;
    case 'otp_expired':
      return AUTH_MESSAGES.invalidCode;
    case 'email_address_invalid':
    case 'validation_failed':
      return AUTH_MESSAGES.invalidEmail;
    case 'email_address_not_authorized':
      return AUTH_MESSAGES.notAuthorized;
    case 'signup_disabled':
    case 'otp_disabled':
    case 'email_provider_disabled':
      return AUTH_MESSAGES.unavailable;
    default:
      return status === 429 ? AUTH_MESSAGES.rateLimited : AUTH_MESSAGES.generic;
  }
}
