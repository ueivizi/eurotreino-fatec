import { parseLegionRoute } from './legion-routes-api';

const row = {
  id: '3f1c2b1e-6a0d-4b8e-9d7a-2c5e8f9a1b3c',
  name: 'Volta da Paulista',
  modality: 'bike',
  points: [
    [-46.63, -23.55],
    [-46.63, -23.545],
  ],
  distance_m: 556,
  created_at: '2026-09-27T12:00:00Z',
  author_name: 'Corredor',
  is_mine: false,
  can_delete: true,
};

describe('rota da Legião', () => {
  it('lê a linha da RPC', () => {
    expect(parseLegionRoute(row)).toEqual({
      id: row.id,
      name: 'Volta da Paulista',
      modality: 'bike',
      points: [
        { lng: -46.63, lat: -23.55 },
        { lng: -46.63, lat: -23.545 },
      ],
      distanceM: 556,
      createdAt: row.created_at,
      authorName: 'Corredor',
      isMine: false,
      canDelete: true,
    });
  });

  it('recusa o que foge do combinado', () => {
    for (const bad of [
      null,
      { ...row, id: 'x' },
      { ...row, modality: 'carro' },
      { ...row, distance_m: 50 },
      { ...row, distance_m: 1.5 },
      { ...row, points: [[-46.63, -23.55]] },
      { ...row, points: [[-46.63, -23.55], [-46.63, 95]] },
      { ...row, points: Array.from({ length: 201 }, () => [-46.63, -23.55]) },
      { ...row, is_mine: 'sim' },
      { ...row, author_name: '' },
    ]) {
      expect(parseLegionRoute(bad)).toBeNull();
    }
  });
});
