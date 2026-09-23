import { parseHistoryMonths, parseHistoryWorkouts } from './history-api';

const WORKOUT = {
  workout_id: '9f1c2a5e-7b3d-4e2f-8a10-6c5d4b3a2f10',
  workout_type: 'corrida',
  module: 'resistencia',
  duration_min: 30,
  intensity: 'moderado',
  performed_at: '2026-09-11T21:00:00Z',
  local_date: '2026-09-11',
  is_scored: true,
  presence_points: 10,
  duration_points: 3,
  intensity_points: 2,
  bonus_points: 0,
  points: 15,
  distance_m: 5000,
  sets_count: null,
  load_kg: null,
  avg_heart_rate: 151,
  note: null,
  can_edit: false,
};

describe('Anais', () => {
  it('converte o mês e recusa o que não é mês', () => {
    expect(parseHistoryMonths([{ month: '2026-09-01', workouts_count: 2, glory: 35 }])).toEqual([
      { month: '2026-09-01', workoutsCount: 2, glory: 35 },
    ]);
    expect(parseHistoryMonths([{ month: 'setembro', workouts_count: 2, glory: 35 }])).toBeNull();
    expect(parseHistoryMonths([{ month: '2026-09-01', workouts_count: -1, glory: 35 }])).toBeNull();
    expect(parseHistoryMonths('nada')).toBeNull();
  });

  it('converte o treino com a composição e os detalhes', () => {
    const [workout] = parseHistoryWorkouts([WORKOUT]) ?? [];
    expect(workout?.type).toBe('corrida');
    expect(workout?.module).toBe('resistencia');
    expect(workout?.points).toBe(15);
    expect(workout?.presence).toBe(10);
    expect(workout?.distanceM).toBe(5000);
    expect(workout?.avgHeartRate).toBe(151);
    expect(workout?.performedAt.toISOString()).toBe('2026-09-11T21:00:00.000Z');
  });

  /* Quem decide se ainda dá para corrigir é o banco, que sabe onde a semana começa em São Paulo. */
  it('lê do servidor se o treino ainda pode ser corrigido', () => {
    expect(parseHistoryWorkouts([{ ...WORKOUT, can_edit: true }])?.[0]?.canEdit).toBe(true);
    expect(parseHistoryWorkouts([{ ...WORKOUT, can_edit: null }])).toHaveLength(0);
  });

  /* Um treino corrompido não pode apagar o mês inteiro da tela: ele sai da lista, o resto fica. */
  it('descarta o treino malformado e mantém os outros', () => {
    const lista = parseHistoryWorkouts([WORKOUT, { ...WORKOUT, workout_id: 'não-é-uuid' }, { ...WORKOUT, intensity: 'brutal' }]);
    expect(lista).toHaveLength(1);
  });

  it('aceita numeric em texto e nota dentro do limite', () => {
    const [workout] = parseHistoryWorkouts([{ ...WORKOUT, workout_type: 'outro', module: 'outro', load_kg: '62.5', note: 'futebol' }]) ?? [];
    expect(workout?.loadKg).toBe(62.5);
    expect(workout?.note).toBe('futebol');
  });

  it('nota vazia ou gigante vira nenhuma nota', () => {
    expect(parseHistoryWorkouts([{ ...WORKOUT, note: '' }])?.[0]?.note).toBeNull();
    expect(parseHistoryWorkouts([{ ...WORKOUT, note: 'a'.repeat(41) }])?.[0]?.note).toBeNull();
  });
});
