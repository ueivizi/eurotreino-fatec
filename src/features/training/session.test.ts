import {
  MAX_SESSION_HOURS,
  addLap,
  addSet,
  lapDurations,
  removeLastLap,
  durationMinutes,
  elapsedMs,
  finishSession,
  formatElapsed,
  isTooLong,
  parseSession,
  pauseSession,
  removeLastSet,
  resumeSession,
  setFocus,
  setsOf,
  startSession,
} from './session';
import { notificationText } from './session-notification';

const USER = 'f8c21c6c-4628-42d3-97da-545f780926a2';
const REQUEST = '8f14e45f-ceea-467a-9575-28262f7a6b26';
const START = new Date('2026-09-16T10:00:00Z');

function newSession() {
  return startSession({ userId: USER, workoutType: 'musculacao', requestId: REQUEST, now: START });
}

function at(minutes: number): Date {
  return new Date(START.getTime() + minutes * 60_000);
}

describe('cronômetro', () => {
  it('conta o tempo corrido desde o início', () => {
    expect(elapsedMs(newSession(), at(30))).toBe(30 * 60_000);
  });

  it('pausa congela o tempo, e retomar volta a contar de onde parou', () => {
    const paused = pauseSession(newSession(), at(10));
    expect(elapsedMs(paused, at(45))).toBe(10 * 60_000);

    const resumed = resumeSession(paused, at(45));
    expect(elapsedMs(resumed, at(50))).toBe(15 * 60_000);
  });

  it('pausar duas vezes não soma o mesmo tempo de novo', () => {
    const once = pauseSession(newSession(), at(10));
    const twice = pauseSession(once, at(20));
    expect(elapsedMs(twice, at(30))).toBe(10 * 60_000);
  });

  it('relógio do aparelho voltando no tempo não vira tempo negativo', () => {
    expect(elapsedMs(newSession(), at(-5))).toBe(0);
  });

  it('a duração enviada respeita os limites do servidor', () => {
    expect(durationMinutes(newSession(), at(0))).toBe(1);
    expect(durationMinutes(newSession(), at(47))).toBe(47);
    expect(durationMinutes(newSession(), at(600))).toBe(300);
  });

  it('avisa quando a sessão passou do razoável', () => {
    expect(isTooLong(newSession(), at(60))).toBe(false);
    expect(isTooLong(newSession(), at(MAX_SESSION_HOURS * 60 + 1))).toBe(true);
  });

  it('formata o tempo como cronômetro', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
  });
});

describe('séries', () => {
  it('guarda e remove a última série de um exercício', () => {
    let session = newSession();
    session = addSet(session, { exerciseId: 'supino-reto-barra', reps: 10, loadKg: 60 }, at(5));
    session = addSet(session, { exerciseId: 'supino-reto-barra', reps: 8, loadKg: 70 }, at(8));
    session = addSet(session, { exerciseId: 'agachamento-livre', reps: 5, loadKg: 100 }, at(12));

    expect(setsOf(session, 'supino-reto-barra')).toHaveLength(2);

    session = removeLastSet(session, 'supino-reto-barra');
    expect(setsOf(session, 'supino-reto-barra').map((set) => set.reps)).toEqual([10]);
    // Remover de um exercício não mexe nos outros.
    expect(setsOf(session, 'agachamento-livre')).toHaveLength(1);
  });

  it('remover de exercício sem série não muda nada', () => {
    const session = newSession();
    expect(removeLastSet(session, 'burpee')).toEqual(session);
  });
});

describe('fim da sessão', () => {
  it('monta o registro com as séries no formato do servidor', () => {
    let session = newSession();
    session = addSet(session, { exerciseId: 'supino-reto-barra', reps: 10, loadKg: 60 }, at(5));
    session = addSet(session, { exerciseId: 'barra-fixa', reps: 8, loadKg: null }, at(9));

    expect(finishSession(session, 'moderado', at(50))).toEqual({
      requestId: REQUEST,
      workoutType: 'musculacao',
      durationMin: 50,
      intensity: 'moderado',
      routineId: null,
      sets: [
        { exercise_id: 'supino-reto-barra', reps: 10, load_kg: 60 },
        { exercise_id: 'barra-fixa', reps: 8, load_kg: null },
      ],
    });
  });

  it('intensidade fora da lista não vira registro', () => {
    expect(finishSession(newSession(), 'extremo', at(30))).toBeNull();
  });
});

describe('sessão guardada no aparelho', () => {
  it('volta igual depois de guardada', () => {
    const session = addSet(newSession(), { exerciseId: 'supino-reto-barra', reps: 10, loadKg: 60 }, at(5));
    expect(parseSession(JSON.stringify(session))).toEqual(session);
  });

  it('descarta conteúdo corrompido, inventado ou de versão antiga', () => {
    const session = newSession();
    expect(parseSession(null)).toBeNull();
    expect(parseSession('{')).toBeNull();
    expect(parseSession('[]')).toBeNull();
    expect(parseSession(JSON.stringify({ ...session, workoutType: 'levitacao' }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...session, startedAt: 'ontem' }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...session, elapsedBeforePauseMs: -1 }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...session, sets: [{ exerciseId: 'supino', reps: 0 }] }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...session, sets: [{ exerciseId: 'supino', reps: 5, loadKg: 900 }] }))).toBeNull();
  });
});

describe('voltas', () => {
  it('marca voltas com o tempo do cronômetro e calcula a duração de cada uma', () => {
    let session = newSession();
    session = addLap(session, at(4));
    session = addLap(session, at(9));
    session = addLap(session, at(15));

    expect(session.laps).toEqual([4 * 60_000, 9 * 60_000, 15 * 60_000]);
    expect(lapDurations(session)).toEqual([4 * 60_000, 5 * 60_000, 6 * 60_000]);
  });

  it('desfaz a última volta', () => {
    const session = addLap(addLap(newSession(), at(4)), at(9));
    expect(removeLastLap(session).laps).toEqual([4 * 60_000]);
    expect(removeLastLap(newSession()).laps).toEqual([]);
  });

  it('sessão antiga sem voltas continua válida', () => {
    const { laps: _laps, ...semVoltas } = newSession();
    expect(parseSession(JSON.stringify(semVoltas))?.laps).toEqual([]);
  });

  it('volta fora de ordem ou negativa derruba a sessão guardada', () => {
    const session = newSession();
    expect(parseSession(JSON.stringify({ ...session, laps: [1000, 500] }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...session, laps: [-1] }))).toBeNull();
    expect(parseSession(JSON.stringify({ ...session, laps: ['x'] }))).toBeNull();
  });
});

describe('o que a notificação mostra', () => {
  const focus = { exerciseId: 'supino', exerciseName: 'Supino reto com barra', reps: 10, loadKg: 62.5 };

  it('guarda o foco e não grava de novo quando nada mudou', () => {
    const session = setFocus(newSession(), focus);
    expect(session.focus).toEqual(focus);
    // Mesma referência: sem mudança, nada de repintar notificação nem gravar no aparelho.
    expect(setFocus(session, { ...focus })).toBe(session);
    expect(setFocus(session, { ...focus, reps: 12 })).not.toBe(session);
  });

  it('sessão guardada antes do foco continua abrindo', () => {
    const { focus: _sem, ...antiga } = newSession();
    expect(parseSession(JSON.stringify(antiga))?.focus).toBeNull();
    expect(parseSession(JSON.stringify({ ...antiga, focus: { exerciseId: 'x' } }))).toBeNull();
  });

  it('na força, diz o exercício, a série da vez e os números', () => {
    const session = addSet(setFocus(newSession(), focus), { exerciseId: 'supino', reps: 10, loadKg: 62.5 }, at(5));
    const { title, body } = notificationText(session, { exerciseName: focus.exerciseName, routineName: 'UPPER' }, at(10));
    expect(title).toBe('UPPER · em andamento');
    expect(body).toBe('Supino reto com barra · série 2 · 10 reps · 62,5 kg');
  });

  it('na resistência, diz as voltas; pausado, diz que está pausado', () => {
    const bike = startSession({ userId: USER, workoutType: 'bike', requestId: REQUEST, now: START });
    expect(notificationText(bike, { exerciseName: null, routineName: null }, at(3)).body).toBe('Sem voltas marcadas');
    const comVolta = addLap(bike, at(4));
    expect(notificationText(comVolta, { exerciseName: null, routineName: null }, at(4)).body).toBe('1 volta');
    const pausada = pauseSession(comVolta, at(5));
    expect(notificationText(pausada, { exerciseName: null, routineName: null }, at(9)).title).toBe('Bike · pausado em 5:00');
  });

  it('peso livre aparece como peso livre', () => {
    const session = setFocus(newSession(), { ...focus, loadKg: null });
    expect(notificationText(session, { exerciseName: focus.exerciseName, routineName: null }, at(1)).body).toContain('peso livre');
  });
});
