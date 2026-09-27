import type { RankingEntry } from './arena-parsers';
import { rivalryFor } from './rivalry';

function entry(userId: string, weekGlory: number, isMe = false): RankingEntry {
  return {
    userId,
    displayName: userId,
    emblem: 'aguia',
    emblemColor: 'ouro',
    role: 'member',
    weekGlory,
    totalGlory: 100,
    place: 1,
    isMe,
  };
}

describe('rival do Coliseu', () => {
  it('mira em quem está logo à frente, não no líder', () => {
    const rivalry = rivalryFor([entry('lider', 90), entry('perto', 40), entry('eu', 30, true)]);
    expect(rivalry).toMatchObject({ kind: 'chasing', gap: 11, workouts: 1 });
    expect(rivalry?.kind === 'chasing' && rivalry.rival.userId).toBe('perto');
  });

  it('conta treinos pela régua de 30 min moderado', () => {
    const rivalry = rivalryFor([entry('lider', 61), entry('eu', 0, true)]);
    expect(rivalry).toMatchObject({ kind: 'chasing', gap: 62, workouts: 5 });
  });

  it('empate e liderança', () => {
    expect(rivalryFor([entry('outro', 30), entry('eu', 30, true)])?.kind).toBe('tied');
    expect(rivalryFor([entry('outro', 12), entry('eu', 30, true)])).toMatchObject({ kind: 'leading', margin: 18 });
    expect(rivalryFor([entry('outro', 0), entry('eu', 30, true)])).toMatchObject({ kind: 'leading', rival: null });
  });

  it('semana zerada não tem rival', () => {
    expect(rivalryFor([entry('outro', 0), entry('eu', 0, true)])).toBeNull();
  });
});
