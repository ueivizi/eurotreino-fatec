import { applyCardEvents, cardState, parseCardEvents } from './lock-card';
import {
  canAddSet,
  markFocusedSet,
  nextOpenItem,
  parseSession,
  remainingSets,
  setFocus,
  setPlan,
  setsOf,
  startSession,
  type PlanItem,
} from './session';

const USER = 'f8c21c6c-4628-42d3-97da-545f780926a2';
const REQUEST = '8f14e45f-ceea-467a-9575-28262f7a6b26';
const START = new Date('2026-09-27T10:00:00Z');

const PLAN: PlanItem[] = [
  { exerciseId: 'supino', name: 'Supino reto', targetSets: 2, reps: 10, loadKg: 60 },
  { exerciseId: 'remada', name: 'Remada curvada', targetSets: 2, reps: 12, loadKg: 40 },
  { exerciseId: 'prancha', name: 'Prancha', targetSets: null, reps: 1, loadKg: null },
];

function at(minutes: number): Date {
  return new Date(START.getTime() + minutes * 60_000);
}

function withPlan() {
  const session = startSession({ userId: USER, workoutType: 'musculacao', requestId: REQUEST, routineName: 'Upper', plan: PLAN, now: START });
  return setFocus(session, { exerciseId: 'supino', exerciseName: 'Supino reto', reps: 10, loadKg: 60 });
}

describe('ficha na sessão', () => {
  it('não deixa passar da meta e segue para o próximo exercício ao fechar', () => {
    let session = withPlan();
    session = markFocusedSet(session, at(1)).session;
    expect(remainingSets(session, 'supino')).toBe(1);
    const closing = markFocusedSet(session, at(3));
    expect(closing.completed).toBe(true);
    session = closing.session;
    expect(session.focus?.exerciseId).toBe('remada');
    expect(session.focus?.loadKg).toBe(40);
    expect(canAddSet(session, 'supino')).toBe(false);
    // Tentar de novo no supino não grava nada.
    const again = markFocusedSet(setFocus(session, { exerciseId: 'supino', exerciseName: 'Supino reto', reps: 10, loadKg: 60 }), at(4));
    expect(setsOf(again.session, 'supino')).toHaveLength(2);
  });

  it('exercício avulso não tem meta', () => {
    const session = withPlan();
    expect(remainingSets(session, 'prancha')).toBeNull();
    expect(canAddSet(session, 'prancha')).toBe(true);
  });

  it('com tudo feito, não há próximo', () => {
    let session = withPlan();
    for (let i = 0; i < 4; i += 1) session = markFocusedSet(session, at(i + 1)).session;
    expect(nextOpenItem(session, 'remada')).toBeNull();
  });

  it('a ficha sobrevive ao aparelho, e sessão antiga entra sem ficha', () => {
    const session = withPlan();
    expect(parseSession(JSON.stringify(session))?.plan).toEqual(PLAN);
    const { plan: _plan, ...old } = session;
    expect(parseSession(JSON.stringify(old))?.plan).toEqual([]);
    expect(parseSession(JSON.stringify({ ...session, plan: [{ ...PLAN[0], targetSets: 0 }] }))).toBeNull();
  });

  it('trocar a ficha por uma igual não cria sessão nova', () => {
    const session = withPlan();
    expect(setPlan(session, PLAN.map((item) => ({ ...item })))).toBe(session);
  });
});

describe('cartão da tela bloqueada', () => {
  it('mostra o exercício da vez, as séries feitas e os números em uso', () => {
    const session = markFocusedSet(withPlan(), at(2)).session;
    const card = cardState(session, at(5));
    expect(card).toMatchObject({ kind: 'forca', title: 'Upper', paused: false, index: 0, laps: 0 });
    expect(card.elapsedMs).toBe(5 * 60_000);
    expect(card.exercises[0]).toEqual({ id: 'supino', name: 'Supino reto', targetSets: 2, done: 1, reps: 10, loadKg: 60 });
    expect(card.exercises[2]).toMatchObject({ targetSets: 0, loadKg: 0 });
  });

  it('aplica os toques na ordem, com as regras da tela', () => {
    const events = parseCardEvents(
      JSON.stringify([
        { t: 'load', id: 'supino', load: 62.5 },
        { t: 'set', id: 'supino', reps: 10, load: 62.5, at: at(2).getTime() },
        { t: 'set', id: 'supino', reps: 8, load: 62.5, at: at(4).getTime() },
        // Terceira série do supino: a meta era 2, então não entra.
        { t: 'set', id: 'supino', reps: 8, load: 62.5, at: at(5).getTime() },
        { t: 'focus', id: 'remada' },
        { t: 'pause', at: at(6).getTime() },
      ]),
    );
    const session = applyCardEvents(withPlan(), events, at(10));
    expect(setsOf(session, 'supino').map((set) => [set.reps, set.loadKg])).toEqual([
      [10, 62.5],
      [8, 62.5],
    ]);
    expect(session.focus?.exerciseId).toBe('remada');
    expect(session.pausedAt).toBe(at(6).toISOString());
  });

  it('descarta evento estranho e não deixa instante no futuro', () => {
    expect(parseCardEvents('não é json')).toEqual([]);
    expect(
      parseCardEvents(
        JSON.stringify([
          { t: 'apagar' },
          { t: 'set', id: 'supino', reps: 0, load: 60, at: 1 },
          { t: 'set', id: '', reps: 10, load: 60, at: 1 },
          { t: 'load', id: 'supino', load: 900 },
          { t: 'pause', at: 'agora' },
        ]),
      ),
    ).toEqual([]);
    const session = applyCardEvents(withPlan(), [{ t: 'pause', at: at(60).getTime() }], at(10));
    expect(session.pausedAt).toBe(at(10).toISOString());
  });
});
