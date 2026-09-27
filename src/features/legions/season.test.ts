import { LOUROS, lourosForWeek, missingForMinimum } from './louros';
import { parseSeasonTable, parseTrophies } from './season-parsers';

const ID = '3f1c2b1e-6a0d-4b8e-9d7a-2c5e8f9a1b3c';
const OTHER = '9b2d7e4a-1c3f-4a5b-8e6d-7f0a1b2c3d4e';

const linha = {
  user_id: ID,
  display_name: 'Aurélia',
  emblem: 'aguia',
  emblem_color: 'ouro',
  role: 'owner',
  louros: 95,
  last_delta: 25,
  weeks_counted: 4,
  weeks_met: 4,
  podiums: 4,
  season_glory: 120,
  week_scored: 1,
  place: 1,
  is_me: true,
  season_start: '2026-08-31',
  season_week: 2,
  weekly_minimum: 3,
};

describe('Louros', () => {
  it('seguem a regra do banco', () => {
    expect(lourosForWeek({ counts: true, met: true, place: 1 })).toBe(LOUROS.met + 15);
    expect(lourosForWeek({ counts: true, met: false, place: 3 })).toBe(-10);
    expect(lourosForWeek({ counts: true, met: false, place: null })).toBe(LOUROS.missed);
    expect(lourosForWeek({ counts: false, met: false, place: null })).toBe(0);
    expect(lourosForWeek({ counts: true, met: true, place: 4 })).toBe(10);
  });

  it('dizem quanto falta para o mínimo', () => {
    expect(missingForMinimum(1, 3)).toBe(2);
    expect(missingForMinimum(5, 3)).toBe(0);
  });
});

describe('tabela da temporada', () => {
  it('converte a tabela e separa os dados da temporada', () => {
    const tabela = parseSeasonTable([
      linha,
      { ...linha, user_id: OTHER, display_name: 'Brutus', louros: 0, last_delta: -15, place: 2, is_me: false },
    ]);
    expect(tabela?.seasonWeek).toBe(2);
    expect(tabela?.weeklyMinimum).toBe(3);
    expect(tabela?.entries.map((entrada) => [entrada.displayName, entrada.louros, entrada.lastDelta])).toEqual([
      ['Aurélia', 95, 25],
      ['Brutus', 0, -15],
    ]);
  });

  it('tabela vazia é temporada que não existe', () => {
    expect(parseSeasonTable([])?.entries).toEqual([]);
  });

  it('recusa números impossíveis', () => {
    expect(parseSeasonTable([{ ...linha, louros: -5 }])).toBeNull();
    expect(parseSeasonTable([{ ...linha, weeks_met: 5 }])).toBeNull();
    expect(parseSeasonTable([{ ...linha, season_week: 7 }])).toBeNull();
    expect(parseSeasonTable([{ ...linha, weekly_minimum: 9 }])).toBeNull();
    expect(parseSeasonTable([linha, { ...linha, user_id: OTHER, season_start: '2026-09-28' }])).toBeNull();
  });
});

describe('Triunfos', () => {
  it('converte, com ou sem o nome da Legião', () => {
    expect(
      parseTrophies([
        { kind: 'triunfo_ouro', group_name: 'Legião Arena', season_start: '2026-08-31', louros: 95, awarded_at: '2026-09-28T10:00:00Z' },
        { kind: 'invicto', group_name: null, season_start: '2026-08-31', louros: 95 },
      ]),
    ).toEqual([
      { kind: 'triunfo_ouro', groupName: 'Legião Arena', seasonStart: '2026-08-31', louros: 95, awardedAt: '2026-09-28T10:00:00Z' },
      { kind: 'invicto', groupName: null, seasonStart: '2026-08-31', louros: 95, awardedAt: null },
    ]);
  });

  it('recusa Triunfo inventado', () => {
    expect(parseTrophies([{ kind: 'campeao', group_name: null, season_start: '2026-08-31', louros: 1 }])).toBeNull();
  });
});
