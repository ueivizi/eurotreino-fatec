import { parseWeeklyGoal } from './goal-api';

const GOAL = {
  target: 4,
  week_start: '2026-09-21',
  days_trained: [true, true, false, true, false, false, false],
  days_done: 3,
  goal_met: false,
  streak_days: 2,
  weeks_in_a_row: 5,
};

describe('juramento da semana', () => {
  it('converte o retrato da semana', () => {
    const goal = parseWeeklyGoal([GOAL]);
    expect(goal?.target).toBe(4);
    expect(goal?.daysDone).toBe(3);
    expect(goal?.daysTrained).toEqual([true, true, false, true, false, false, false]);
    expect(goal?.goalMet).toBe(false);
    expect(goal?.streakDays).toBe(2);
    expect(goal?.weeksInARow).toBe(5);
  });

  /* Quem não jurou nada não tem meta: a tela convida, em vez de mostrar "0 de 0". */
  it('aceita a semana sem juramento', () => {
    expect(parseWeeklyGoal([{ ...GOAL, target: null, goal_met: false }])?.target).toBeNull();
  });

  it('recusa meta fora da faixa de 1 a 7', () => {
    expect(parseWeeklyGoal([{ ...GOAL, target: 0 }])).toBeNull();
    expect(parseWeeklyGoal([{ ...GOAL, target: 8 }])).toBeNull();
  });

  /* A semana tem sete dias; qualquer outra coisa é resposta fora do combinado. */
  it('recusa semana que não tem sete dias, ou que não é de booleanos', () => {
    expect(parseWeeklyGoal([{ ...GOAL, days_trained: [true, false] }])).toBeNull();
    expect(parseWeeklyGoal([{ ...GOAL, days_trained: [1, 0, 0, 0, 0, 0, 0] }])).toBeNull();
    expect(parseWeeklyGoal([{ ...GOAL, days_trained: null }])).toBeNull();
  });

  it('recusa contagem inválida e resposta que não é uma linha só', () => {
    expect(parseWeeklyGoal([{ ...GOAL, days_done: -1 }])).toBeNull();
    expect(parseWeeklyGoal([{ ...GOAL, goal_met: 'sim' }])).toBeNull();
    expect(parseWeeklyGoal([{ ...GOAL, week_start: 'segunda' }])).toBeNull();
    expect(parseWeeklyGoal([GOAL, GOAL])).toBeNull();
    expect(parseWeeklyGoal([])).toBeNull();
    expect(parseWeeklyGoal(GOAL)).toBeNull();
  });
});
