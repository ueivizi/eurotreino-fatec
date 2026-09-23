import { isIsoDate, isNonNegativeInteger, singleRow } from '@/lib/parse';
import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

/**
 * Juramento da semana (RF015 a RF017): a meta pessoal, os dias já treinados, a sequência de dias e
 * a Chama de Vesta. Nada disso encosta na Glória nem no Coliseu — é o placar de quem treina
 * sozinho, e o servidor tem teste provando que a pontuação não muda.
 *
 * Como sempre, o que chega é conferido aqui: os tipos gerados marcam como obrigatório campo que
 * pode vir nulo.
 */

export const GOAL_MAX = 7;

export type WeeklyGoal = {
  /** Dias por semana prometidos; `null` quando não há juramento em vigor. */
  target: number | null;
  /** Segunda-feira da semana (America/Sao_Paulo), no formato AAAA-MM-DD. */
  weekStart: string;
  /** Sete posições, de segunda a domingo: verdadeiro no dia em que houve treino. */
  daysTrained: readonly boolean[];
  daysDone: number;
  goalMet: boolean;
  /** Dias seguidos com treino, contados até hoje ou ontem. */
  streakDays: number;
  /** Chama de Vesta: semanas seguidas em que o juramento foi cumprido. */
  weeksInARow: number;
};

export function parseWeeklyGoal(value: unknown): WeeklyGoal | null {
  const row = singleRow(value);
  if (!row) return null;

  const { target, week_start: weekStart, days_trained: daysTrained } = row;
  if (target !== null && (!isNonNegativeInteger(target) || target < 1 || target > GOAL_MAX)) return null;
  if (!isIsoDate(weekStart)) return null;
  if (!Array.isArray(daysTrained) || daysTrained.length !== 7 || daysTrained.some((day) => typeof day !== 'boolean')) return null;

  const { days_done: daysDone, goal_met: goalMet, streak_days: streakDays, weeks_in_a_row: weeksInARow } = row;
  if (!isNonNegativeInteger(daysDone) || !isNonNegativeInteger(streakDays) || !isNonNegativeInteger(weeksInARow)) return null;
  if (typeof goalMet !== 'boolean') return null;

  return {
    target: target as number | null,
    weekStart: weekStart as string,
    daysTrained: daysTrained as boolean[],
    daysDone,
    goalMet,
    streakDays,
    weeksInARow,
  };
}

export async function fetchWeeklyGoal(): Promise<WeeklyGoal> {
  const { data, error } = await getSupabase().rpc('my_weekly_goal');
  if (error) throw toApiError(error);
  const goal = parseWeeklyGoal(data);
  if (!goal) throw unexpectedResponse();
  return goal;
}

/** Jura (ou muda) a meta da semana corrente. Zero é "sem juramento". */
export async function setWeeklyGoal(target: number): Promise<WeeklyGoal> {
  const { data, error } = await getSupabase().rpc('set_weekly_goal', { p_target: target });
  if (error) throw toApiError(error);
  const goal = parseWeeklyGoal(data);
  if (!goal) throw unexpectedResponse();
  return goal;
}
