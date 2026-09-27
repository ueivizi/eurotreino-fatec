import type { RankingEntry } from './arena-parsers';

/**
 * Pódio é de quem pontuou: só entra quem tem Glória na semana, até três pessoas.
 *
 * O ranking divide empates (1, 2, 3, 3), e cortar os três primeiros sem olhar a Glória punha
 * no degrau III alguém com zero, enquanto o outro empatado aparecia de novo como 3º na lista.
 * Quem não pontuou fica na lista, na posição que o servidor deu.
 */
export function splitPodium(entries: readonly RankingEntry[]): { podium: RankingEntry[]; rest: RankingEntry[] } {
  const podium = entries.filter((entry) => entry.weekGlory > 0).slice(0, 3);
  const onPodium = new Set(podium.map((entry) => entry.userId));
  return { podium, rest: entries.filter((entry) => !onPodium.has(entry.userId)) };
}
