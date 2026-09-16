import { isAuthCode, parseAuthProviders, parseAuthRedirect } from './oauth';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn(), supabaseConfig: { ok: false, problem: 'missing' } }));

describe('parseAuthProviders', () => {
  it('só liga cada provedor quando o Auth diz exatamente true', () => {
    expect(parseAuthProviders({ external: { google: true, apple: false, email: true } })).toEqual({ google: true, apple: false });
    expect(parseAuthProviders({ external: { apple: true } })).toEqual({ google: false, apple: true });
    expect(parseAuthProviders({ external: { google: 'true', apple: 1 } })).toEqual({ google: false, apple: false });
    expect(parseAuthProviders({ external: null })).toEqual({ google: false, apple: false });
    expect(parseAuthProviders('erro')).toEqual({ google: false, apple: false });
  });
});

describe('parseAuthRedirect', () => {
  it('lê o código do retorno no app nativo e na Web', () => {
    const code = '4c7e8f2a-1b3d-4e5f-9a8b-7c6d5e4f3a2b';
    expect(parseAuthRedirect(`exp://192.168.0.10:8081/--/auth/callback?code=${code}`)).toEqual({ kind: 'code', code });
    expect(parseAuthRedirect(`eurotreino://auth/callback?code=${code}#`)).toEqual({ kind: 'code', code });
  });

  it('reconhece erro na consulta ou no fragmento', () => {
    expect(parseAuthRedirect('eurotreino://auth/callback#error=access_denied&error_description=cancelado')).toEqual({
      kind: 'error',
      error: 'access_denied',
    });
    expect(parseAuthRedirect('eurotreino://auth/callback?error=server_error')).toEqual({ kind: 'error', error: 'server_error' });
  });

  it('recusa código ausente, curto ou com caracteres fora da regra', () => {
    expect(parseAuthRedirect('eurotreino://auth/callback')).toEqual({ kind: 'none' });
    expect(parseAuthRedirect('eurotreino://auth/callback?code=abc')).toEqual({ kind: 'none' });
    expect(parseAuthRedirect('eurotreino://auth/callback?code=%3Cscript%3Ealert(1)%3C%2Fscript%3E')).toEqual({ kind: 'none' });
    expect(parseAuthRedirect('eurotreino://auth/callback?code=%E0%A4%A')).toEqual({ kind: 'none' });
    expect(isAuthCode(undefined)).toBe(false);
  });
});
