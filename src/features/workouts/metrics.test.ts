import {
  MIN_PACE_DISTANCE_M,
  formatDistance,
  formatLoad,
  formatPace,
  formatPerformance,
  formatSpeed,
  paceSecondsPerKm,
  speedKmPerHour,
} from './metrics';

describe('formatDistance', () => {
  it('usa metros abaixo de 1 km e quilômetro acima', () => {
    expect(formatDistance(800)).toBe('800 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1 km');
    expect(formatDistance(7500)).toBe('7,5 km');
    expect(formatDistance(42195)).toBe('42,2 km');
  });

  it('acima de 100 km não mostra casa decimal', () => {
    expect(formatDistance(120000)).toBe('120 km');
  });

  it('valor inválido vira travessão, nunca NaN na tela', () => {
    expect(formatDistance(0)).toBe('—');
    expect(formatDistance(Number.NaN)).toBe('—');
    expect(formatDistance(-5)).toBe('—');
  });
});

describe('ritmo e velocidade', () => {
  it('ritmo sai no formato de corrida', () => {
    expect(formatPace(257)).toBe('4:17 /km');
    expect(formatPace(360)).toBe('6:00 /km');
    expect(formatPace(605)).toBe('10:05 /km');
  });

  it('10 km em 60 min dão 6:00 /km e 10,0 km/h', () => {
    expect(paceSecondsPerKm(10000, 60)).toBe(360);
    expect(formatSpeed(speedKmPerHour(10000, 60) as number)).toBe('10,0 km/h');
  });

  it('abaixo de 1 km não existe ritmo', () => {
    expect(paceSecondsPerKm(MIN_PACE_DISTANCE_M - 1, 5)).toBeNull();
    expect(paceSecondsPerKm(MIN_PACE_DISTANCE_M, 5)).not.toBeNull();
    expect(formatPerformance('ritmo', 400, 2)).toBeNull();
  });

  it('duração zero não divide por zero', () => {
    expect(paceSecondsPerKm(5000, 0)).toBeNull();
    expect(speedKmPerHour(5000, 0)).toBeNull();
  });

  it('cada modalidade escolhe como ser lida', () => {
    expect(formatPerformance('ritmo', 5000, 25)).toBe('5:00 /km');
    expect(formatPerformance('velocidade', 20000, 60)).toBe('20,0 km/h');
  });
});

describe('formatLoad', () => {
  it('mostra meio quilo quando existe e some com o zero à toa', () => {
    expect(formatLoad(60)).toBe('60 kg');
    expect(formatLoad(62.5)).toBe('62,5 kg');
    expect(formatLoad(0)).toBe('—');
  });
});
