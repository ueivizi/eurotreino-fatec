/**
 * Código vindo de um link de convite aberto antes de a pessoa entrar no app. Fica só na memória:
 * depois do login e do perfil inicial, o Início leva direto à entrada na Legião.
 */
let pendingCode: string | null = null;

export function rememberInvite(code: string) {
  pendingCode = code;
}

export function takePendingInvite(): string | null {
  const code = pendingCode;
  pendingCode = null;
  return code;
}
