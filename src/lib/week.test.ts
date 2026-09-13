import { formatRemaining, toRoman, weekInfo } from './week';

describe('weekInfo (horário de Brasília)', () => {
  it('termina na segunda seguinte às 00:00 de Brasília (03:00 UTC)', () => {
    // Quinta, 17/09/2026 15:00 UTC = 12:00 em Brasília.
    const info = weekInfo(new Date('2026-09-17T15:00:00Z'));
    expect(info.endsAt.toISOString()).toBe('2026-09-21T03:00:00.000Z');
    expect(info.number).toBe(38);
  });

  it('domingo 23:59 em Brasília ainda pertence à semana corrente', () => {
    // Domingo 20/09/2026 23:59 em Brasília = segunda 02:59 UTC.
    const info = weekInfo(new Date('2026-09-21T02:59:00Z'));
    expect(info.endsAt.toISOString()).toBe('2026-09-21T03:00:00.000Z');
    expect(info.remainingMs).toBe(60 * 1000);
  });

  it('segunda 00:00 em Brasília já abre a semana seguinte', () => {
    const info = weekInfo(new Date('2026-09-21T03:00:00Z'));
    expect(info.endsAt.toISOString()).toBe('2026-09-28T03:00:00.000Z');
    expect(info.number).toBe(39);
  });

  it('recusa datas inválidas', () => {
    expect(() => weekInfo(new Date('não é data'))).toThrow(RangeError);
  });
});

describe('formatRemaining', () => {
  it('formata dias, horas e minutos', () => {
    expect(formatRemaining((2 * 24 + 5) * 3600 * 1000 + 59 * 60 * 1000)).toBe('2d 5h');
    expect(formatRemaining((5 * 60 + 12) * 60 * 1000)).toBe('5h 12min');
    expect(formatRemaining(12 * 60 * 1000)).toBe('12min');
    expect(formatRemaining(-5000)).toBe('0min');
  });
});

describe('toRoman', () => {
  it('converte números de semana e divisões', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(38)).toBe('XXXVIII');
    expect(toRoman(39)).toBe('XXXIX');
    expect(toRoman(53)).toBe('LIII');
  });

  it('recusa valores fora do intervalo', () => {
    expect(() => toRoman(0)).toThrow(RangeError);
    expect(() => toRoman(2.5)).toThrow(RangeError);
  });
});
