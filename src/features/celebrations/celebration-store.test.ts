import { clearCelebrations, dismissCelebration, enqueueCelebrations, peekCelebrations } from './celebration-store';

describe('fila de celebrações', () => {
  afterEach(() => clearCelebrations());

  it('toca na ordem em que chegaram e sai ao dispensar', () => {
    enqueueCelebrations([{ kind: 'constancy', bonus: 10, weekGlory: 40 }, { kind: 'first-workout' }]);
    const [first, second] = peekCelebrations();
    expect(first?.celebration.kind).toBe('constancy');
    expect(second?.celebration.kind).toBe('first-workout');

    dismissCelebration(first!.id);
    expect(peekCelebrations().map((item) => item.celebration.kind)).toEqual(['first-workout']);
  });

  it('dispensar um id que já saiu não mexe na fila', () => {
    enqueueCelebrations([{ kind: 'first-workout' }]);
    const before = peekCelebrations();
    dismissCelebration(-1);
    expect(peekCelebrations()).toBe(before);
  });

  it('descarta o excedente em vez de acumular uma maratona de cerimônias', () => {
    enqueueCelebrations(Array.from({ length: 10 }, () => ({ kind: 'first-workout' as const })));
    expect(peekCelebrations()).toHaveLength(6);
    enqueueCelebrations([{ kind: 'first-workout' }]);
    expect(peekCelebrations()).toHaveLength(6);
  });

  it('dá ids únicos mesmo para celebrações iguais', () => {
    enqueueCelebrations([{ kind: 'first-workout' }, { kind: 'first-workout' }]);
    const ids = peekCelebrations().map((item) => item.id);
    expect(new Set(ids).size).toBe(2);
  });
});
