import { EMPTY_TRACK, MAX_ACCURACY_M, addFix, decimate, signalQuality, type Fix } from './gps-track';

const INICIO = { lat: -23.5329, lng: -46.7918 };

function fix(metrosAoNorte: number, segundos: number, accuracy: number | null = 8): Fix {
  // Um grau de latitude são ~111,2 km: 1 m ao norte ≈ 0,000009°.
  return { lat: INICIO.lat + metrosAoNorte / 111195, lng: INICIO.lng, accuracy, at: segundos * 1000 };
}

describe('percurso do GPS', () => {
  it('soma os trechos de uma corrida', () => {
    let track = EMPTY_TRACK;
    for (let i = 0; i <= 10; i += 1) track = addFix(track, fix(i * 30, i * 10));
    expect(track.points).toHaveLength(11);
    expect(Math.round(track.distanceM)).toBe(300);
  });

  it('descarta leitura imprecisa', () => {
    const track = addFix(addFix(EMPTY_TRACK, fix(0, 0)), fix(50, 10, MAX_ACCURACY_M + 1));
    expect(track.points).toHaveLength(1);
    expect(track.distanceM).toBe(0);
  });

  it('parado no lugar não soma distância', () => {
    const track = addFix(addFix(EMPTY_TRACK, fix(0, 0)), fix(2, 10));
    expect(track.distanceM).toBe(0);
  });

  it('salto impossível do sinal é ignorado', () => {
    // 500 m em 2 s = 250 m/s.
    const track = addFix(addFix(EMPTY_TRACK, fix(0, 0)), fix(500, 2));
    expect(track.points).toHaveLength(1);
  });

  it('coordenada absurda é ignorada', () => {
    expect(addFix(EMPTY_TRACK, { lat: 95, lng: 0, accuracy: 5, at: 0 }).points).toHaveLength(0);
  });

  it('diz se o sinal é confiável', () => {
    expect(signalQuality(8)).toBe('bom');
    expect(signalQuality(60)).toBe('fraco');
    expect(signalQuality(null)).toBe('desconhecido');
  });
});

describe('percurso vira rota', () => {
  it('reduz os pontos mantendo o começo e o fim', () => {
    const pontos = Array.from({ length: 1000 }, (_, i) => i);
    const menor = decimate(pontos, 200);
    expect(menor).toHaveLength(200);
    expect(menor[0]).toBe(0);
    expect(menor[199]).toBe(999);
    expect(decimate([1, 2, 3], 200)).toEqual([1, 2, 3]);
  });
});
