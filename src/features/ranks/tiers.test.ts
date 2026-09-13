import { rankFromGlory } from './tiers';

describe('rankFromGlory', () => {
  it('começa em Recruta III com 0 de Glória', () => {
    const rank = rankFromGlory(0);
    expect(rank.label).toBe('Recruta III');
    expect(rank.next).toEqual({ label: 'Recruta II', min: 35, remaining: 35 });
    expect(rank.progress).toBe(0);
  });

  it('muda de divisão exatamente no limite', () => {
    expect(rankFromGlory(34).label).toBe('Recruta III');
    expect(rankFromGlory(35).label).toBe('Recruta II');
    expect(rankFromGlory(99).label).toBe('Recruta I');
    expect(rankFromGlory(100).label).toBe('Legionário III');
  });

  it('calcula o progresso dentro da divisão (exemplo do design: 468 = Centurião II)', () => {
    const rank = rankFromGlory(468);
    expect(rank.label).toBe('Centurião II');
    expect(rank.currentMin).toBe(415);
    expect(rank.next).toEqual({ label: 'Centurião I', min: 530, remaining: 62 });
    expect(rank.progress).toBeCloseTo((468 - 415) / (530 - 415));
  });

  it('passa de Semideus I para Olimpiano, que não tem divisões nem próximo nível', () => {
    expect(rankFromGlory(3499).label).toBe('Semideus I');
    const top = rankFromGlory(3500);
    expect(top.label).toBe('Olimpiano');
    expect(top.division).toBeNull();
    expect(top.next).toBeNull();
    expect(top.progress).toBe(1);
    expect(rankFromGlory(99999).label).toBe('Olimpiano');
  });

  it('recusa valores inválidos em vez de adivinhar um rank', () => {
    expect(() => rankFromGlory(-1)).toThrow(RangeError);
    expect(() => rankFromGlory(10.5)).toThrow(RangeError);
    expect(() => rankFromGlory(Number.NaN)).toThrow(RangeError);
  });
});
