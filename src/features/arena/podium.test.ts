import type { RankingEntry } from './arena-parsers';
import { splitPodium } from './podium';

function entry(userId: string, weekGlory: number, place: number): RankingEntry {
  return {
    userId,
    displayName: userId,
    emblem: 'aguia',
    emblemColor: 'ouro',
    role: 'member',
    weekGlory,
    totalGlory: 100,
    place,
    isMe: false,
  };
}

describe('pódio do Coliseu', () => {
  it('leva os três primeiros que pontuaram', () => {
    const { podium, rest } = splitPodium([entry('a', 35, 1), entry('b', 18, 2), entry('c', 12, 3), entry('d', 4, 4)]);
    expect(podium.map((item) => item.userId)).toEqual(['a', 'b', 'c']);
    expect(rest.map((item) => item.userId)).toEqual(['d']);
  });

  it('quem tem zero fica na lista, mesmo empatado em 3º', () => {
    const { podium, rest } = splitPodium([entry('a', 35, 1), entry('b', 18, 2), entry('c', 0, 3), entry('d', 0, 3)]);
    expect(podium.map((item) => item.userId)).toEqual(['a', 'b']);
    expect(rest.map((item) => [item.userId, item.place])).toEqual([
      ['c', 3],
      ['d', 3],
    ]);
  });

  it('semana que acabou de começar não tem pódio', () => {
    const { podium, rest } = splitPodium([entry('a', 0, 1), entry('b', 0, 1)]);
    expect(podium).toEqual([]);
    expect(rest).toHaveLength(2);
  });
});
