import { getSupabase } from '@/lib/supabase';

import { AUTH_MESSAGES, authErrorMessage } from './auth-errors';

/**
 * Entrada com e-mail e senha (RF001).
 *
 * A senha nunca é guardada, registrada nem enviada a outro lugar: vai direto para o Supabase Auth,
 * que faz o hash no servidor. Este módulo só decide o que a tela mostra.
 *
 * Duas regras de privacidade valem aqui:
 * - erro de entrada é sempre genérico ("e-mail ou senha incorretos"), para não dizer quem tem conta;
 * - criar conta e pedir troca de senha respondem igual para e-mail conhecido e desconhecido.
 */

export type PasswordResult =
  | { status: 'signed-in' }
  /** Falta confirmar o e-mail: o código já foi enviado. */
  | { status: 'needs-code' }
  | { status: 'error'; message: string };

export async function signInWithPassword(email: string, password: string): Promise<PasswordResult> {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) {
    // E-mail ainda não confirmado: manda um código novo e segue para a tela do código.
    if ((error as { code?: unknown }).code === 'email_not_confirmed') {
      await getSupabase().auth.resend({ type: 'signup', email });
      return { status: 'needs-code' };
    }
    return { status: 'error', message: authErrorMessage(error) };
  }
  return data.session ? { status: 'signed-in' } : { status: 'error', message: AUTH_MESSAGES.generic };
}

/**
 * Cria a conta. Com a confirmação de e-mail ligada no projeto, o Supabase devolve uma resposta igual
 * para e-mail novo e para e-mail já cadastrado — por isso o app segue para o código nos dois casos,
 * sem revelar qual foi.
 */
export async function signUpWithPassword(email: string, password: string): Promise<PasswordResult> {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) return { status: 'error', message: authErrorMessage(error) };
  return data.session ? { status: 'signed-in' } : { status: 'needs-code' };
}

/** Confirma a conta com o código do e-mail de boas-vindas. */
export async function confirmSignUp(email: string, token: string): Promise<PasswordResult> {
  const { data, error } = await getSupabase().auth.verifyOtp({ email, token, type: 'signup' });
  if (error) return { status: 'error', message: authErrorMessage(error) };
  return data.session ? { status: 'signed-in' } : { status: 'error', message: AUTH_MESSAGES.generic };
}

/** Reenvia o código de confirmação do cadastro. */
export async function resendSignUpCode(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await getSupabase().auth.resend({ type: 'signup', email });
  return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
}

/**
 * Pede a troca de senha. Só erros que a pessoa precisa ver (limite de envio, e-mail inválido)
 * chegam à tela; "não existe conta com este e-mail" nunca é revelado.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email);
  return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
}

/**
 * Conclui a troca: o código do e-mail abre uma sessão de recuperação e, só então, a senha nova é
 * gravada. Sem o código válido não há sessão, e a troca falha fechada.
 */
export async function confirmPasswordReset(email: string, token: string, password: string): Promise<PasswordResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
  if (error) return { status: 'error', message: authErrorMessage(error) };
  if (!data.session) return { status: 'error', message: AUTH_MESSAGES.generic };

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    // A senha não trocou: a sessão aberta pelo código não pode continuar valendo.
    await supabase.auth.signOut();
    return { status: 'error', message: authErrorMessage(updateError) };
  }
  return { status: 'signed-in' };
}
