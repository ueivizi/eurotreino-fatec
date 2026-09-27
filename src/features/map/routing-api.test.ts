import { formatDistance } from '@/features/workouts/metrics';

import { describeRoutedPath, parseRoutedPaths } from './routing-api';

const rota = {
  pontos: [
    [-46.6333, -23.5505],
    [-46.63, -23.548],
  ],
  distanciaM: 5234,
  subidaM: 41,
  descidaM: 40,
  cicloviaPct: 57,
  calmaPct: 60,
};

describe('resposta do roteador', () => {
  it('lê as rotas no formato combinado', () => {
    const paths = parseRoutedPaths({ rotas: [rota], credito: 'x' });
    expect(paths).toHaveLength(1);
    expect(paths?.[0]?.points[0]).toEqual({ lng: -46.6333, lat: -23.5505 });
    expect(paths?.[0]?.cyclewayPct).toBe(57);
  });

  it('recusa o que foge do formato', () => {
    for (const body of [
      null,
      {},
      { rotas: [] },
      { rotas: [rota, rota, rota, rota] },
      { rotas: [{ ...rota, pontos: [[-46.6, -23.5]] }] },
      { rotas: [{ ...rota, pontos: [[-46.6, -23.5], [-46.6, 95]] }] },
      { rotas: [{ ...rota, pontos: [[-46.6, -23.5], ['a', 'b']] }] },
      { rotas: [{ ...rota, distanciaM: -1 }] },
      { rotas: [{ ...rota, cicloviaPct: 101 }] },
      { rotas: [{ ...rota, subidaM: undefined }] },
    ]) {
      expect(parseRoutedPaths(body)).toBeNull();
    }
  });

  it('resume distância, subida e ciclovia, só o que conta', () => {
    const [path] = parseRoutedPaths({ rotas: [rota] }) ?? [];
    expect(path && describeRoutedPath(path, formatDistance)).toBe(`${formatDistance(5234)} · subida de 41 m · 57% em ciclovia`);
    const flat = path && { ...path, ascentM: 2, cyclewayPct: 0, calmPct: 35 };
    expect(flat && describeRoutedPath(flat, formatDistance)).toBe(`${formatDistance(5234)} · 35% longe dos carros`);
  });
});
