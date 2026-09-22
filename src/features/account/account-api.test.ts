import { deletionFailureReason, deletionReference } from './account-api';

describe('deletionFailureReason', () => {
  it('reconhece só os códigos combinados com a função', () => {
    expect(deletionFailureReason({ error: 'reauthentication_required' })).toBe('reauthentication_required');
    expect(deletionFailureReason({ error: 'not_authenticated' })).toBe('not_authenticated');
    expect(deletionFailureReason({ error: 'delete_failed' })).toBe('failed');
    expect(deletionFailureReason({ error: 'toString' })).toBe('failed');
    expect(deletionFailureReason('texto')).toBe('failed');
    expect(deletionFailureReason(null)).toBe('failed');
  });
});

describe('deletionReference', () => {
  it('junta o status ao código da função ou do gateway', () => {
    expect(deletionReference({ status: 500 }, { error: 'delete_failed' })).toBe('500 delete_failed');
    expect(deletionReference({ status: 401 }, { code: 'UNAUTHORIZED_INVALID_JWT_FORMAT', message: 'Invalid JWT' })).toBe(
      '401 UNAUTHORIZED_INVALID_JWT_FORMAT',
    );
  });

  it('não repassa texto livre vindo da resposta', () => {
    expect(deletionReference({ status: 400 }, { error: 'fulano@exemplo.com' })).toBe('400');
    expect(deletionReference({ status: 400 }, { message: 'qualquer coisa' })).toBe('400');
    expect(deletionReference(null, null)).toBe('http');
  });
});
