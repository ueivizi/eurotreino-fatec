import type { RankingEntry } from '@/features/arena/arena-parsers';
import type { LoggedWorkout } from '@/features/workouts/workouts-parsers';

import { celebrationsForWorkout, type ArenaSnapshot } from './detect';

function logged(overrides: Partial<LoggedWorkout> = {}): LoggedWorkout {
  return {
    workoutId: '00000000-0000-4000-8000-000000000001',
    presence: 10,
    duration: 4,
    intensity: 2,
    bonus: 0,
    points: 16,
    isScored: true,
    weekGlory: 16,
    totalGlory: 20,
    replayed: false,
  isDistanceRecord: false,
    ...overrides,
  };
}

function entry(userId: string, place: number, weekGlory: number, isMe = false): RankingEntry {
  return {
    userId,
    displayName: isMe ? 'Lucas' : `Membro ${userId}`,
    emblem: 'aguia',
    role: 'member',
    weekGlory,
    totalGlory: 400,
    place,
    isMe,
  };
}

function arena(before: RankingEntry[], after: RankingEntry[], legionName = 'Legião Fênix'): ArenaSnapshot {
  return { legionId: '00000000-0000-4000-8000-00000000000a', legionName, before, after };
}

describe('celebrationsForWorkout', () => {
  it('não celebra reenvio, treino sem pontos nem registro zerado', () => {
    const arenas = [arena([entry('b', 1, 30), entry('me', 2, 20, true)], [entry('me', 1, 40, true), entry('b', 2, 30)])];
    expect(celebrationsForWorkout({ result: logged({ replayed: true }), previousTotalWorkouts: 0, arenas })).toEqual([]);
    expect(
      celebrationsForWorkout({ result: logged({ isScored: false, points: 0 }), previousTotalWorkouts: 0, arenas }),
    ).toEqual([]);
  });

  it('anuncia a Ascensão quando o rank muda (Recruta I → Legionário III)', () => {
    const result = logged({ totalGlory: 104, points: 16 });
    const [first] = celebrationsForWorkout({ result, previousTotalWorkouts: 5, arenas: [] });
    expect(first).toMatchObject({ kind: 'ascension', fromTier: 1, toTier: 2, label: 'Legionário III', division: 'III', glory: 104 });
  });

  it('anuncia nova divisão sem Ascensão quando só a divisão muda (Recruta III → II)', () => {
    const result = logged({ totalGlory: 40, points: 16 });
    const list = celebrationsForWorkout({ result, previousTotalWorkouts: 2, arenas: [] });
    expect(list).toEqual([
      expect.objectContaining({ kind: 'division', fromDivision: 'III', division: 'II', label: 'Recruta II' }),
    ]);
  });

  it('não repete a cerimônia de rank quando a Glória fica na mesma divisão', () => {
    const list = celebrationsForWorkout({ result: logged({ totalGlory: 30, points: 16 }), previousTotalWorkouts: 2, arenas: [] });
    expect(list).toEqual([]);
  });

  it('celebra a constância do 3º treino e o primeiro treino', () => {
    const list = celebrationsForWorkout({
      result: logged({ bonus: 10, points: 26, totalGlory: 26, weekGlory: 26 }),
      previousTotalWorkouts: 0,
      arenas: [],
    });
    expect(list.map((item) => item.kind)).toEqual(['constancy', 'first-workout']);
    expect(list[0]).toEqual({ kind: 'constancy', bonus: 10, weekGlory: 26 });
  });

  it('sem saber quantos treinos havia antes, não inventa o primeiro treino', () => {
    const list = celebrationsForWorkout({ result: logged(), previousTotalWorkouts: null, arenas: [] });
    expect(list).toEqual([]);
  });

  it('mostra quem você ultrapassou na Arena, do mais próximo ao mais distante', () => {
    const before = [entry('a', 1, 60), entry('b', 2, 44), entry('c', 3, 30), entry('me', 4, 20, true)];
    const after = [entry('a', 1, 60), entry('me', 2, 46, true), entry('b', 3, 44), entry('c', 4, 30)];
    const [scene] = celebrationsForWorkout({ result: logged(), previousTotalWorkouts: 3, arenas: [arena(before, after)] });

    expect(scene).toMatchObject({ kind: 'arena', fromPlace: 4, toPlace: 2, passed: ['Membro c', 'Membro b'] });
    if (scene?.kind !== 'arena') throw new Error('esperava a cena da Arena');
    expect(scene.standings.map((row) => [row.userId, row.beforePlace, row.afterPlace])).toEqual([
      ['c', 3, 4],
      ['b', 2, 3],
      ['me', 4, 2],
    ]);
  });

  it('empatar com alguém não conta como ultrapassar', () => {
    const before = [entry('a', 1, 30), entry('me', 2, 14, true)];
    const after = [entry('a', 1, 30), entry('me', 1, 30, true)];
    expect(celebrationsForWorkout({ result: logged(), previousTotalWorkouts: 3, arenas: [arena(before, after)] })).toEqual([]);
  });

  it('nunca celebra posição igual ou pior', () => {
    const before = [entry('me', 1, 30, true), entry('a', 2, 20)];
    const after = [entry('me', 1, 46, true), entry('a', 2, 20)];
    expect(celebrationsForWorkout({ result: logged(), previousTotalWorkouts: 3, arenas: [arena(before, after)] })).toEqual([]);
  });

  it('entre várias Legiões, escolhe a melhor posição final e toca uma cena só', () => {
    const fenix = arena(
      [entry('a', 1, 50), entry('b', 2, 40), entry('me', 3, 30, true)],
      [entry('a', 1, 50), entry('me', 2, 46, true), entry('b', 3, 40)],
      'Legião Fênix',
    );
    const loba = arena([entry('x', 1, 20), entry('me', 2, 10, true)], [entry('me', 1, 26, true), entry('x', 2, 20)], 'Legião Loba');
    const list = celebrationsForWorkout({ result: logged(), previousTotalWorkouts: 3, arenas: [fenix, loba] });
    expect(list.filter((item) => item.kind === 'arena')).toEqual([expect.objectContaining({ legionName: 'Legião Loba', toPlace: 1 })]);
  });

  it('ordena a fila da maior conquista para a menor', () => {
    const before = [entry('a', 1, 90), entry('me', 2, 80, true)];
    const after = [entry('me', 1, 106, true), entry('a', 2, 90)];
    const list = celebrationsForWorkout({
      result: logged({ totalGlory: 104, points: 26, bonus: 10, weekGlory: 106 }),
      previousTotalWorkouts: 7,
      arenas: [arena(before, after)],
    });
    expect(list.map((item) => item.kind)).toEqual(['ascension', 'arena', 'constancy']);
  });
});
