import {
  availableDayOffsets,
  clampPerformedAt,
  dayOffsetOf,
  describePerformedAt,
  performedAtBounds,
  stepPerformedAt,
  suggestedPerformedAt,
  withDayOffset,
} from './performed-at';

// Datas em horário local do aparelho, como o app usa.
const now = new Date(2026, 8, 17, 18, 42);

describe('janela do registro retroativo', () => {
  it('vai de 48 h atrás (com folga) até agora, em passos de 15 minutos', () => {
    const { min, max } = performedAtBounds(now);
    expect(max).toEqual(new Date(2026, 8, 17, 18, 30));
    expect(min).toEqual(new Date(2026, 8, 15, 19, 0));
  });

  it('ajusta horários fora da janela para o limite mais próximo', () => {
    expect(clampPerformedAt(new Date(2026, 8, 17, 20, 0), now)).toEqual(new Date(2026, 8, 17, 18, 30));
    expect(clampPerformedAt(new Date(2026, 8, 14, 12, 0), now)).toEqual(new Date(2026, 8, 15, 19, 0));
    expect(clampPerformedAt(new Date(2026, 8, 16, 7, 40), now)).toEqual(new Date(2026, 8, 16, 7, 30));
  });

  it('sugere uma hora atrás', () => {
    expect(suggestedPerformedAt(now)).toEqual(new Date(2026, 8, 17, 17, 30));
  });

  it('não deixa passar do agora nem do limite de 48 h', () => {
    expect(stepPerformedAt(new Date(2026, 8, 17, 18, 30), 1, now)).toBeNull();
    expect(stepPerformedAt(new Date(2026, 8, 15, 19, 0), -1, now)).toBeNull();
    expect(stepPerformedAt(new Date(2026, 8, 17, 18, 15), 1, now)).toEqual(new Date(2026, 8, 17, 18, 30));
  });
});

describe('dias', () => {
  it('oferece hoje, ontem e anteontem enquanto houver horário aceito', () => {
    expect(availableDayOffsets(now)).toEqual([0, 1, 2]);
    expect(availableDayOffsets(new Date(2026, 8, 17, 23, 55))).toEqual([0, 1]);
  });

  it('troca o dia mantendo o horário, dentro da janela', () => {
    expect(withDayOffset(new Date(2026, 8, 17, 7, 0), 1, now)).toEqual(new Date(2026, 8, 16, 7, 0));
    expect(withDayOffset(new Date(2026, 8, 17, 7, 0), 2, now)).toEqual(new Date(2026, 8, 15, 19, 0));
    expect(dayOffsetOf(new Date(2026, 8, 15, 23, 0), now)).toBe(2);
  });

  it('descreve o horário escolhido', () => {
    expect(describePerformedAt(null, now)).toBe('Agora');
    expect(describePerformedAt(new Date(2026, 8, 16, 7, 30), now)).toBe('Ontem, 07:30');
  });
});
