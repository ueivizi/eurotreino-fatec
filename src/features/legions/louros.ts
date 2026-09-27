/**
 * Regras da Legião competitiva, as mesmas de `private.louros_delta` no banco (o teste do banco
 * compara as duas). O app só explica e projeta; quem conta os Louros é o servidor.
 */
export const LOUROS = {
  /** Cumpriu o mínimo de treinos pontuados da semana. */
  met: 10,
  /** Não cumpriu: é aqui que o modo competitivo cobra. */
  missed: -15,
  /** Pódio da semana, entre quem pontuou: 1º, 2º e 3º. */
  podium: [15, 10, 5] as const,
} as const;

export const SEASON_WEEKS = 4;

/** Louros de uma semana fechada. Semana em que a pessoa ainda não era membro não conta. */
export function lourosForWeek({ counts, met, place }: { counts: boolean; met: boolean; place: number | null }): number {
  if (!counts) return 0;
  const podium = place !== null && place >= 1 && place <= 3 ? LOUROS.podium[place - 1] : 0;
  return (met ? LOUROS.met : LOUROS.missed) + (podium ?? 0);
}

export type TrophyKind = 'triunfo_ouro' | 'triunfo_prata' | 'triunfo_bronze' | 'invicto';

export const TROPHY_KINDS: readonly TrophyKind[] = ['triunfo_ouro', 'triunfo_prata', 'triunfo_bronze', 'invicto'];

export const TROPHY_LABELS: Record<TrophyKind, { title: string; description: string }> = {
  triunfo_ouro: { title: 'Triunfo de ouro', description: '1º lugar na tabela da temporada' },
  triunfo_prata: { title: 'Triunfo de prata', description: '2º lugar na tabela da temporada' },
  triunfo_bronze: { title: 'Triunfo de bronze', description: '3º lugar na tabela da temporada' },
  invicto: { title: 'Invicto', description: 'Cumpriu o mínimo nas quatro semanas' },
};

export function isTrophyKind(value: unknown): value is TrophyKind {
  return typeof value === 'string' && (TROPHY_KINDS as readonly string[]).includes(value);
}

/** Quanto falta para não perder Louros nesta semana. */
export function missingForMinimum(scored: number, minimum: number): number {
  return Math.max(0, minimum - scored);
}
