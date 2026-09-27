import { MAX_POINTS, addRoutePoint, closeRoute, haversineMeters, routeBounds, routeDistanceM, routeProgress, routeShape, simplifyRoute } from './route';

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

describe('progresso na rota', () => {
  // Três pontos numa reta norte-sul, ~111 m entre eles.
  const line = [
    { lat: -23.55, lng: -46.63 },
    { lat: -23.549, lng: -46.63 },
    { lat: -23.548, lng: -46.63 },
  ];

  it('mede o que foi feito, o que falta e o afastamento', () => {
    const progress = routeProgress({ lat: -23.5495, lng: -46.63 }, line);
    expect(progress?.offRouteM).toBe(0);
    expect(progress?.doneM).toBeGreaterThan(50);
    expect(progress?.doneM).toBeLessThan(60);
    expect((progress?.doneM ?? 0) + (progress?.remainingM ?? 0)).toBe(routeDistanceM(line));
  });

  it('diz quando a pessoa saiu da rota', () => {
    const progress = routeProgress({ lat: -23.549, lng: -46.629 }, line);
    expect(progress?.offRouteM).toBeGreaterThan(90);
  });

  it('em volta fechada, quem está no começo ainda tem a volta toda pela frente', () => {
    const loop = [...line, { lat: -23.548, lng: -46.629 }, { lat: -23.55, lng: -46.63 }];
    const progress = routeProgress({ lat: -23.55, lng: -46.63 }, loop);
    expect(progress?.doneM).toBe(0);
    expect(progress?.remainingM).toBe(routeDistanceM(loop));
  });

  it('sem traçado não há progresso', () => {
    expect(routeProgress({ lat: 0, lng: 0 }, [{ lat: 0, lng: 0 }])).toBeNull();
  });
});

describe('simplificar traçado', () => {
  it('mantém começo e fim e respeita o teto', () => {
    const wiggle = Array.from({ length: 1000 }, (_, i) => ({ lat: -23.55 + i * 0.00005, lng: -46.63 + (i % 2) * 0.00001 }));
    const simple = simplifyRoute(wiggle, 200);
    expect(simple.length).toBeLessThanOrEqual(200);
    expect(simple[0]).toEqual(wiggle[0]);
    expect(simple[simple.length - 1]).toEqual(wiggle[wiggle.length - 1]);
  });

  it('não mexe no que já cabe', () => {
    expect(simplifyRoute(line3(), 200)).toHaveLength(3);
  });
});

function line3() {
  return [
    { lat: 0, lng: 0 },
    { lat: 0.001, lng: 0 },
    { lat: 0.002, lng: 0.001 },
  ];
}
