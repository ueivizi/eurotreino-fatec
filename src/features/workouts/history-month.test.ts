import { daysInMonth, gloryByDay } from './history-month';

describe('Anais: Glória por dia', () => {
  it('sabe o tamanho de cada mês', () => {
    expect(daysInMonth('2026-09-01')).toBe(30);
    expect(daysInMonth('2026-02-01')).toBe(28);
    expect(daysInMonth('2028-02-01')).toBe(29);
    expect(daysInMonth('lixo')).toBe(0);
  });

  it('soma a Glória de cada dia e ignora o treino sem ponto', () => {
    const dias = gloryByDay(
      [
        { performedAt: new Date(2026, 8, 16, 8, 0), isScored: true, points: 20 },
        { performedAt: new Date(2026, 8, 16, 19, 0), isScored: true, points: 12 },
        { performedAt: new Date(2026, 8, 16, 21, 0), isScored: false, points: 0 },
        { performedAt: new Date(2026, 8, 30, 7, 0), isScored: true, points: 18 },
      ],
      '2026-09-01',
    );
    expect(dias).toHaveLength(30);
    expect(dias[15]).toBe(32);
    expect(dias[29]).toBe(18);
    expect(dias.reduce((soma, dia) => soma + dia, 0)).toBe(50);
  });

  it('treino de outro mês não entra', () => {
    const dias = gloryByDay([{ performedAt: new Date(2026, 9, 1, 8, 0), isScored: true, points: 20 }], '2026-09-01');
    expect(dias.every((dia) => dia === 0)).toBe(true);
  });
});
