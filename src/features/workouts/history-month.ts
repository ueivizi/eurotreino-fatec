/** Um treino do mês, só com o que o gráfico precisa. */
type DayWorkout = { performedAt: Date; isScored: boolean; points: number };

/** Quantos dias tem o mês de "AAAA-MM-01". */
export function daysInMonth(month: string): number {
  const [year, index] = month.split('-').map(Number);
  if (!year || !index) return 0;
  return new Date(year, index, 0).getDate();
}

/**
 * Glória de cada dia do mês, do dia 1 ao último, para as barras dos Anais.
 * Treino que passou do teto do dia soma zero: a barra mostra Glória, não esforço.
 */
export function gloryByDay(workouts: readonly DayWorkout[], month: string): number[] {
  const [year, index] = month.split('-').map(Number);
  const days = Array.from({ length: daysInMonth(month) }, () => 0);
  for (const workout of workouts) {
    const at = workout.performedAt;
    if (at.getFullYear() !== year || at.getMonth() + 1 !== index || !workout.isScored) continue;
    days[at.getDate() - 1] += workout.points;
  }
  return days;
}
