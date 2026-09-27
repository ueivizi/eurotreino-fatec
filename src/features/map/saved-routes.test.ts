import { MAX_ROUTES, normalizeRouteName, parseSavedRoutes, serializeRoutes, withRoute, type SavedRoute } from './saved-routes';

function rota(id: string, name = 'Volta da praça'): SavedRoute {
  const points = [
    { lat: -23.5329, lng: -46.7918 },
    { lat: -23.5339, lng: -46.7918 },
  ];
  return { id, name, points, distanceM: 111, savedAt: '2026-09-26T10:00:00.000Z' };
}

describe('rotas guardadas no aparelho', () => {
  it('ida e volta pelo armazenamento preserva o traçado', () => {
    const [lida] = parseSavedRoutes(serializeRoutes([rota('a')]));
    expect(lida?.name).toBe('Volta da praça');
    expect(lida?.points).toEqual(rota('a').points);
    expect(lida?.distanceM).toBeGreaterThan(100);
  });

  it('não confia no que está guardado', () => {
    expect(parseSavedRoutes(null)).toEqual([]);
    expect(parseSavedRoutes('{isso não é json')).toEqual([]);
    expect(parseSavedRoutes('{"a":1}')).toEqual([]);
    const ruins = JSON.stringify([
      { id: 'x', name: 'ok', savedAt: '2026-09-26T10:00:00Z', points: [[0, 95], [0, 0]] },
      { id: 'y', name: '', savedAt: '2026-09-26T10:00:00Z', points: [[0, 0], [0, 1]] },
      { id: 'z', name: 'ok', savedAt: 'ontem', points: [[0, 0], [0, 1]] },
      { id: 'w', name: 'ok', savedAt: '2026-09-26T10:00:00Z', points: [[0, 0]] },
    ]);
    expect(parseSavedRoutes(ruins)).toEqual([]);
  });

  it('a distância vem dos pontos, não do que estava escrito', () => {
    const adulterada = JSON.stringify([{ id: 'a', name: 'x', savedAt: '2026-09-26T10:00:00Z', distanceM: 999999, points: [[0, 0], [0, 0.01]] }]);
    expect(parseSavedRoutes(adulterada)[0]?.distanceM).toBeLessThan(1200);
  });

  it('a mais recente vem primeiro, com teto', () => {
    let rotas: SavedRoute[] = [];
    for (let i = 0; i < MAX_ROUTES + 3; i += 1) rotas = withRoute(rotas, rota(String(i)));
    expect(rotas).toHaveLength(MAX_ROUTES);
    expect(rotas[0]?.id).toBe(String(MAX_ROUTES + 2));
    expect(withRoute(rotas, rota('5', 'Outro nome')).filter((item) => item.id === '5')).toHaveLength(1);
  });

  it('nome sem espaços sobrando e com limite', () => {
    expect(normalizeRouteName('  Rota   do domingo ')).toBe('Rota do domingo');
    expect(normalizeRouteName('x'.repeat(80))).toHaveLength(40);
  });
});
