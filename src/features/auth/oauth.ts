import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { isRow } from '@/lib/parse';
import { getSupabase, supabaseConfig } from '@/lib/supabase';

import { AUTH_MESSAGES, authErrorMessage } from './auth-errors';

/**
 * Entrada com Google (RF001) pelo fluxo PKCE: o código de autorização que volta na URL só vale
 * junto com o verificador guardado neste aparelho, então um link de retorno interceptado não abre
 * a conta. Os endereços de retorno aceitos ficam na lista do Supabase Auth.
 */

export type AuthProviders = { google: boolean };

/** Configuração pública do Auth (/auth/v1/settings): só o que o app usa, e falso na dúvida. */
export function parseAuthProviders(value: unknown): AuthProviders {
  if (!isRow(value) || !isRow(value.external)) return { google: false };
  return { google: value.external.google === true };
}

/** Provedores ligados no projeto: o botão do Google só aparece depois de configurado. */
export async function fetchAuthProviders(): Promise<AuthProviders> {
  if (!supabaseConfig.ok) return { google: false };
  // A URL do projeto já foi validada por formato fixo; o caminho é constante.
  const response = await fetch(`${supabaseConfig.url}/auth/v1/settings`, {
    headers: { apikey: supabaseConfig.publishableKey },
  });
  if (!response.ok) return { google: false };
  return parseAuthProviders(await response.json());
}

const AUTH_CODE = /^[A-Za-z0-9._~-]{8,512}$/;

export function isAuthCode(value: unknown): value is string {
  return typeof value === 'string' && AUTH_CODE.test(value);
}

export type AuthRedirect = { kind: 'code'; code: string } | { kind: 'error'; error: string } | { kind: 'none' };

/** Lê o retorno do login social: código na consulta (?code=) ou erro na consulta ou no fragmento. */
export function parseAuthRedirect(url: string): AuthRedirect {
  const params = new Map<string, string>();
  for (const section of url.split(/[?#]/).slice(1)) {
    for (const pair of section.split('&')) {
      const separator = pair.indexOf('=');
      if (separator <= 0) continue;
      try {
        params.set(decodeURIComponent(pair.slice(0, separator)), decodeURIComponent(pair.slice(separator + 1)));
      } catch {
        // Parâmetro malformado é ignorado; sem código válido o login não segue.
      }
    }
  }

  const error = params.get('error') ?? params.get('error_code');
  if (error) return { kind: 'error', error };
  const code = params.get('code');
  return isAuthCode(code) ? { kind: 'code', code } : { kind: 'none' };
}

export type OAuthResult =
  | { status: 'signed-in' }
  | { status: 'redirecting' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export const OAUTH_CANCELLED_MESSAGE = 'A entrada com o Google foi cancelada.';

const exchangedCodes = new Set<string>();

/** Troca o código pela sessão uma única vez (a tela de retorno e o fluxo nativo podem receber o mesmo). */
export async function exchangeAuthCode(code: string): Promise<OAuthResult> {
  if (exchangedCodes.has(code)) return { status: 'signed-in' };
  exchangedCodes.add(code);
  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  return error ? { status: 'error', message: authErrorMessage(error) } : { status: 'signed-in' };
}

export async function signInWithGoogle(): Promise<OAuthResult> {
  const supabase = getSupabase();
  const redirectTo = Linking.createURL('auth/callback');

  if (Platform.OS === 'web') {
    // Na Web a página inteira vai ao Google e volta em /auth/callback.
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    return error ? { status: 'error', message: authErrorMessage(error) } : { status: 'redirecting' };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { status: 'error', message: error ? authErrorMessage(error) : AUTH_MESSAGES.generic };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { status: 'cancelled' };

  const redirect = parseAuthRedirect(result.url);
  if (redirect.kind === 'error') {
    return { status: 'error', message: redirect.error === 'access_denied' ? OAUTH_CANCELLED_MESSAGE : AUTH_MESSAGES.generic };
  }
  if (redirect.kind === 'none') return { status: 'error', message: AUTH_MESSAGES.generic };
  return exchangeAuthCode(redirect.code);
}
