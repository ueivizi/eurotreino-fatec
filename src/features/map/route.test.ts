import { MAX_POINTS, addRoutePoint, closeRoute, haversineMeters, routeBounds, routeDistanceM, routeShape } from './route';

const PRACA = { lat: -23.5329, lng: -46.7918 };

describe('rota desenhada', () => {
  /* Um grau de latitude são ~111,2 km em qualquer lugar do mundo: é a medida que dá para conferir. */
  it('mede a distância entre dois pontos', () => {
    const um_grau = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(Math.round(um_grau / 1000)).toBe(111);
    expect(haversineMeters(PRACA, PRACA)).toBe(0);
  });

  it('soma os trechos do traçado', () => {
    const pontos = [
      { lat: 0, lng: 0 },
      { lat: 0.01, lng: 0 },
      { lat: 0.01, lng: 0.01 },
    ];
    // Dois trechos de ~1,11 km cada.
    expect(routeDistanceM(pontos)).toBeGreaterThan(2200);
    expect(routeDistanceM(pontos)).toBeLessThan(2240);
    expect(routeDistanceM([PRACA])).toBe(0);
    expect(routeDistanceM([])).toBe(0);
  });

  it('toque repetido no mesmo lugar não vira ponto novo', () => {
    const pontos = addRoutePoint([PRACA], { lat: PRACA.lat + 0.000001, lng: PRACA.lng });
    expect(pontos).toHaveLength(1);
  });

  it('coordenada impossível é ignorada', () => {
    expect(addRoutePoint([], { lat: 95, lng: 0 })).toHaveLength(0);
    expect(addRoutePoint([], { lat: 0, lng: Number.NaN })).toHaveLength(0);
  });

  it('o traçado tem teto', () => {
    let pontos = [PRACA];
    for (let i = 1; i < MAX_POINTS + 10; i += 1) pontos = addRoutePoint(pontos, { lat: PRACA.lat + i * 0.001, lng: PRACA.lng });
    expect(pontos).toHaveLength(MAX_POINTS);
  });

  it('fechar o circuito volta ao primeiro ponto', () => {
    const volta = closeRoute([
      { lat: 0, lng: 0 },
      { lat: 0.01, lng: 0 },
      { lat: 0.01, lng: 0.01 },
    ]);
    expect(volta).toHaveLength(4);
    expect(volta[3]).toEqual({ lat: 0, lng: 0 });
    // Trajeto curto demais ou já fechado não ganha ponto repetido.
    expect(closeRoute([PRACA])).toHaveLength(1);
    expect(closeRoute(volta)).toHaveLength(4);
  });

  /* O mapa lê longitude antes da latitude; trocar as duas põe o treino no oceano. */
  it('o GeoJSON sai com longitude na frente', () => {
    expect(routeShape([PRACA]).features[0]?.geometry.coordinates[0]).toEqual([-46.7918, -23.5329]);
  });

  it('a caixa do traçado vai de oeste a leste e de sul a norte', () => {
    expect(routeBounds([])).toBeNull();
    expect(
      routeBounds([
        { lat: -23.5, lng: -46.8 },
        { lat: -23.6, lng: -46.7 },
      ]),
    ).toEqual([-46.8, -23.6, -46.7, -23.5]);
  });
});
