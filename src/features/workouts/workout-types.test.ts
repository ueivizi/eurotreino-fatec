import { DURATION, intensityLabel, stepDuration, workoutTypeLabel } from './workout-types';

describe('stepDuration', () => {
  it('avança e recua de 5 em 5 minutos', () => {
    expect(stepDuration(50, 1)).toBe(55);
    expect(stepDuration(50, -1)).toBe(45);
  });

  it('respeita os limites de 1 a 300 minutos', () => {
    expect(stepDuration(3, -1)).toBe(DURATION.min);
    expect(stepDuration(298, 1)).toBe(DURATION.max);
    expect(stepDuration(DURATION.max, 1)).toBe(DURATION.max);
  });

  it('volta ao mínimo se receber um valor inválido', () => {
    expect(stepDuration(Number.NaN, 1)).toBe(6);
    expect(stepDuration(12.5, -1)).toBe(DURATION.min);
  });
});

describe('rótulos', () => {
  it('traduz os identificadores conhecidos', () => {
    expect(workoutTypeLabel('natacao')).toBe('Natação');
    expect(intensityLabel('moderado')).toBe('Moderado');
  });

  it('recusa identificadores desconhecidos', () => {
    // @ts-expect-error valor fora da lista, simulando dado inválido vindo de fora
    expect(() => workoutTypeLabel('parkour')).toThrow(RangeError);
  });
});
