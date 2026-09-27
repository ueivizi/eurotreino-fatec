import type { ModalityRecord } from '@/features/workouts/records-api';

import { modalityRows } from './honor-records';
import type { HonorEntry } from './strength-api';

function honra(workoutType: string | null, exerciseId: string | null = null): HonorEntry {
  return {
    exerciseId,
    exerciseName: exerciseId,
    workoutType,
    points: 19,
    levelId: 1,
    levelName: 'Aprendiz',
    nextLevelPoints: 50,
    bestLoadKg: null,
    bestReps: null,
    bestE1rm: null,
  };
}

function recorde(type: ModalityRecord['type']): ModalityRecord {
  return {
    type,
    module: 'resistencia',
    workoutsCount: 8,
    totalMinutes: 367,
    bestDistanceM: 20000,
    totalDistanceM: 44500,
    bestPaceSecondsPerKm: 180,
    bestLoadKg: null,
    bestSetsCount: null,
  };
}

describe('Honra e recordes', () => {
  it('junta a Honra e os recordes da mesma modalidade', () => {
    const linhas = modalityRows([honra('bike')], [recorde('bike')]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.honor?.levelName).toBe('Aprendiz');
    expect(linhas[0]?.record?.bestDistanceM).toBe(20000);
  });

  it('modalidade só com recordes entra depois das que têm Honra', () => {
    const linhas = modalityRows([honra('bike')], [recorde('corrida'), recorde('bike')]);
    expect(linhas.map((linha) => linha.type)).toEqual(['bike', 'corrida']);
    expect(linhas[1]?.honor).toBeNull();
  });

  it('Honra de exercício não vira modalidade', () => {
    expect(modalityRows([honra(null, 'supino')], [])).toEqual([]);
  });
});
