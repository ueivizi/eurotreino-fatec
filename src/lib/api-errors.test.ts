import { AUTH_MESSAGES, authErrorMessage } from '@/features/auth/auth-errors';

import { RPC_MESSAGES, rpcErrorCode, rpcErrorMessage, toApiError } from './rpc-errors';

describe('authErrorMessage', () => {
  it('reconhece falha de rede', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', status: 0 })).toBe(AUTH_MESSAGES.network);
  });

  it('traduz os códigos conhecidos', () => {
    expect(authErrorMessage({ code: 'over_email_send_rate_limit', status: 429 })).toBe(AUTH_MESSAGES.rateLimited);
    expect(authErrorMessage({ code: 'otp_expired', status: 403 })).toBe(AUTH_MESSAGES.invalidCode);
    expect(authErrorMessage({ code: 'email_address_not_authorized', status: 400 })).toBe(AUTH_MESSAGES.notAuthorized);
  });

  it('nunca repassa a mensagem original', () => {
    expect(authErrorMessage({ code: 'unexpected_failure', message: 'db host 10.0.0.1 down', status: 500 })).toBe(
      AUTH_MESSAGES.generic,
    );
    expect(authErrorMessage('texto solto')).toBe(AUTH_MESSAGES.generic);
    expect(authErrorMessage(null)).toBe(AUTH_MESSAGES.generic);
  });
});

describe('rpcErrorMessage', () => {
  it('traduz os códigos das funções do banco', () => {
    expect(rpcErrorMessage({ code: 'P0001', message: 'group_full' })).toBe('Esta Legião já tem 50 membros.');
    expect(rpcErrorCode({ code: 'PT429', message: 'rate_limited' })).toBe('rate_limited');
  });

  it('reconhece falha de rede do supabase-js', () => {
    expect(rpcErrorMessage({ code: '', message: 'TypeError: Failed to fetch' })).toBe(RPC_MESSAGES.network);
    expect(toApiError({ code: '', message: 'TypeError: Network request failed' }).network).toBe(true);
    expect(toApiError({ code: 'PT429', message: 'rate_limited' }).network).toBe(false);
  });

  it('não expõe erros desconhecidos nem propriedades herdadas', () => {
    expect(rpcErrorMessage({ code: '42P01', message: 'relation "private.audit_log" does not exist' })).toBe(
      RPC_MESSAGES.generic,
    );
    expect(rpcErrorMessage({ code: 'P0001', message: 'toString' })).toBe(RPC_MESSAGES.generic);
    expect(rpcErrorCode({ message: 'constructor' })).toBeNull();
  });
});
