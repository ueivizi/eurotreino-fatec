import {
  MAX_SESSION_HOURS,
  addSet,
  durationMinutes,
  elapsedMs,
  finishSession,
  formatElapsed,
  isTooLong,
  parseSession,
  pauseSession,
  removeLastSet,
  resumeSession,
  setsOf,
  startSession,
} from './session';

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
