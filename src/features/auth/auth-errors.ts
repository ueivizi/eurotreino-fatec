/**
 * Mensagens em português para os erros do Supabase Auth. Nunca exibimos a mensagem original:
 * ela é técnica, em inglês, e pode revelar detalhes da configuração.
 */

export const AUTH_MESSAGES = {
  network: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
  rateLimited: 'Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.',
  invalidCode: 'Código incorreto ou vencido. Confira o e-mail ou peça um código novo.',
  invalidEmail: 'Confira o endereço de e-mail.',
  /** Genérica de propósito: dizer "este e-mail não tem conta" entregaria quem já usa o app. */
  invalidCredentials: 'E-mail ou senha incorretos.',
  emailNotConfirmed: 'Confirme seu e-mail antes de entrar. Use o código que enviamos para você.',
  weakPassword: 'Escolha uma senha mais forte, com pelo menos 8 caracteres.',
  samePassword: 'A senha nova precisa ser diferente da atual.',
  needsReauth: 'Por segurança, entre de novo antes de trocar a senha.',
  accountExists: 'Este e-mail já tem conta. Entre com sua senha ou use "Esqueci minha senha".',
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
    case 'invalid_credentials':
      return AUTH_MESSAGES.invalidCredentials;
    case 'email_not_confirmed':
      return AUTH_MESSAGES.emailNotConfirmed;
    case 'weak_password':
      return AUTH_MESSAGES.weakPassword;
    case 'same_password':
      return AUTH_MESSAGES.samePassword;
    case 'reauthentication_needed':
    case 'session_expired':
      return AUTH_MESSAGES.needsReauth;
    case 'email_address_invalid':
    case 'validation_failed':
      return AUTH_MESSAGES.invalidEmail;
    case 'email_address_not_authorized':
      return AUTH_MESSAGES.notAuthorized;
    case 'user_already_exists':
    case 'email_exists':
      return AUTH_MESSAGES.accountExists;
    case 'signup_disabled':
    case 'otp_disabled':
    case 'email_provider_disabled':
      return AUTH_MESSAGES.unavailable;
    default:
      return status === 429 ? AUTH_MESSAGES.rateLimited : AUTH_MESSAGES.generic;
  }
}
