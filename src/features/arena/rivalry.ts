import { workoutPoints } from '@/features/ranks/scoring';

import type { RankingEntry } from './arena-parsers';

/** Um treino típico (30 min, moderado): a régua para "cerca de N treinos". */
const TYPICAL = (() => {
  const points = workoutPoints(30, 'moderado');
  return points.presence + points.duration + points.intensity;
})();

export type Rivalry =
  | { kind: 'chasing'; rival: RankingEntry; gap: number; workouts: number; progress: number }
  | { kind: 'tied'; rival: RankingEntry }
  | { kind: 'leading'; rival: RankingEntry | null; margin: number };

/** Quem está logo à frente (ou logo atrás, se a pessoa lidera) e quanto falta. */
export function rivalryFor(entries: readonly RankingEntry[]): Rivalry | null {
  const me = entries.find((entry) => entry.isMe);
  if (!me) return null;
  const others = entries.filter((entry) => !entry.isMe);
  const ahead = others.filter((entry) => entry.weekGlory > me.weekGlory).sort((a, b) => a.weekGlory - b.weekGlory)[0];
  if (ahead) {
    const gap = ahead.weekGlory - me.weekGlory + 1;
    return { kind: 'chasing', rival: ahead, gap, workouts: Math.ceil(gap / TYPICAL), progress: me.weekGlory / ahead.weekGlory };
  }
  if (me.weekGlory === 0) return null;
  const tied = others.find((entry) => entry.weekGlory === me.weekGlory);
  if (tied) return { kind: 'tied', rival: tied };
  const behind = [...others].sort((a, b) => b.weekGlory - a.weekGlory)[0] ?? null;
  return { kind: 'leading', rival: behind && behind.weekGlory > 0 ? behind : null, margin: me.weekGlory - (behind?.weekGlory ?? 0) };
}
