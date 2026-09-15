import { deletionFailureReason } from './account-api';

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
