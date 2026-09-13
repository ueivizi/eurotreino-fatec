import { computeStandings } from './standings';

describe('computeStandings', () => {
  it('ordena pela Glória da semana, do maior para o menor', () => {
    const result = computeStandings([
      { id: 'a', name: 'Lucas', weekGlory: 78 },
      { id: 'b', name: 'Digão', weekGlory: 90 },
      { id: 'c', name: 'Camila', weekGlory: 52 },
    ]);
    expect(result.map((m) => [m.name, m.position])).toEqual([
      ['Digão', 1],
      ['Lucas', 2],
      ['Camila', 3],
    ]);
  });

  it('empates compartilham a posição e a seguinte pula (1, 2, 2, 4)', () => {
    const result = computeStandings([
      { id: 'a', name: 'Rafa', weekGlory: 30 },
      { id: 'b', name: 'Bia', weekGlory: 30 },
      { id: 'c', name: 'Digão', weekGlory: 90 },
      { id: 'd', name: 'Téo', weekGlory: 0 },
    ]);
    expect(result.map((m) => [m.name, m.position])).toEqual([
      ['Digão', 1],
      ['Bia', 2],
      ['Rafa', 2],
      ['Téo', 4],
    ]);
  });

  it('não altera a lista original', () => {
    const input = [
      { id: 'a', name: 'A', weekGlory: 1 },
      { id: 'b', name: 'B', weekGlory: 2 },
    ];
    computeStandings(input);
    expect(input.map((m) => m.id)).toEqual(['a', 'b']);
  });
});
