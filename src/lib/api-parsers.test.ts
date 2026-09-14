import { parseWeeklyRanking } from '@/features/arena/arena-parsers';
import {
  parseCreatedLegion,
  parseInvite,
  parseInvitePreview,
  parseJoinResult,
  parseMyLegions,
} from '@/features/legions/legions-parsers';
import { parseLoggedWorkout, parseMyProgress } from '@/features/workouts/workouts-parsers';

const ID = '3f1c2b1e-6a0d-4b8e-9d7a-2c5e8f9a1b3c';
const OTHER_ID = '9b2d7e4a-1c3f-4a5b-8e6d-7f0a1b2c3d4e';

describe('parseMyLegions', () => {
  const row = { group_id: ID, name: 'Legião Fênix', emblem: 'aguia', role: 'owner', member_count: 4, joined_at: '2026-09-14T12:00:00+00:00' };

  it('converte a lista de Legiões', () => {
    expect(parseMyLegions([row])).toEqual([
      { id: ID, name: 'Legião Fênix', emblem: 'aguia', role: 'owner', memberCount: 4, joinedAt: '2026-09-14T12:00:00+00:00' },
    ]);
    expect(parseMyLegions([])).toEqual([]);
  });

  it('recusa a resposta inteira se um item vier fora do formato', () => {
    expect(parseMyLegions([row, { ...row, role: 'admin' }])).toBeNull();
    expect(parseMyLegions([{ ...row, emblem: 'fenix' }])).toBeNull();
    expect(parseMyLegions([{ ...row, member_count: -1 }])).toBeNull();
    expect(parseMyLegions({ rows: [row] })).toBeNull();
  });
});

describe('convites', () => {
  it('converte o convite e a Legião recém-fundada', () => {
    expect(parseInvite([{ code: 'ABCD2345', expires_at: '2026-09-21T12:00:00+00:00' }])).toEqual({
      code: 'ABCD2345',
      expiresAt: '2026-09-21T12:00:00+00:00',
    });
    expect(
      parseCreatedLegion([
        { group_id: ID, name: 'Legião Fênix', emblem: 'loba', invite_code: 'ABCD2345', invite_expires_at: '2026-09-21T12:00:00Z' },
      ]),
    ).toEqual({ id: ID, name: 'Legião Fênix', emblem: 'loba', invite: { code: 'ABCD2345', expiresAt: '2026-09-21T12:00:00Z' } });
  });

  it('recusa código fora da regra ou resposta com mais de uma linha', () => {
    expect(parseInvite([{ code: 'abcd2345', expires_at: '2026-09-21T12:00:00Z' }])).toBeNull();
    expect(parseInvite([{ code: 'ABCD2345', expires_at: 'amanhã' }])).toBeNull();
    const invite = { code: 'ABCD2345', expires_at: '2026-09-21T12:00:00Z' };
    expect(parseInvite([invite, invite])).toBeNull();
  });

  it('converte a prévia conforme o status', () => {
    expect(
      parseInvitePreview([{ status: 'ok', group_name: 'Legião Fênix', group_emblem: 'aguia', member_count: 3, is_member: false }]),
    ).toEqual({ status: 'ok', name: 'Legião Fênix', emblem: 'aguia', memberCount: 3, isMember: false });
    expect(parseInvitePreview([{ status: 'invalid', group_name: null, group_emblem: null, member_count: null, is_member: null }])).toEqual({
      status: 'invalid',
    });
    expect(parseInvitePreview([{ status: 'desconhecido' }])).toBeNull();
    expect(parseInvitePreview([{ status: 'ok', group_name: null }])).toBeNull();
  });

  it('converte o resultado da entrada, sem aceitar id onde não deveria haver', () => {
    expect(parseJoinResult([{ status: 'joined', group_id: ID, group_name: 'Legião Fênix' }])).toEqual({
      status: 'joined',
      legionId: ID,
      legionName: 'Legião Fênix',
    });
    expect(parseJoinResult([{ status: 'group_full', group_id: null, group_name: 'Legião Cheia' }])).toEqual({
      status: 'group_full',
      legionName: 'Legião Cheia',
    });
    expect(parseJoinResult([{ status: 'rate_limited', group_id: null, group_name: null }])).toEqual({ status: 'rate_limited' });
    expect(parseJoinResult([{ status: 'joined', group_id: 'x', group_name: 'Legião Fênix' }])).toBeNull();
  });
});

describe('parseWeeklyRanking', () => {
  const entry = {
    user_id: ID,
    display_name: 'Ana',
    emblem: 'aguia',
    role: 'owner',
    week_glory: 40,
    total_glory: 57,
    place: 1,
    is_me: true,
    week_start: '2026-09-14',
  };

  it('converte a classificação e a semana', () => {
    const ranking = parseWeeklyRanking([entry, { ...entry, user_id: OTHER_ID, display_name: 'Bruno', role: 'member', week_glory: 34, place: 2, is_me: false }]);
    expect(ranking?.weekStart).toBe('2026-09-14');
    expect(ranking?.entries.map((e) => `${e.place}:${e.displayName}`)).toEqual(['1:Ana', '2:Bruno']);
    expect(ranking?.entries[0]).not.toHaveProperty('weekStart');
  });

  it('aceita Legião vazia e recusa semanas misturadas ou posição zero', () => {
    expect(parseWeeklyRanking([])).toEqual({ weekStart: null, entries: [] });
    expect(parseWeeklyRanking([entry, { ...entry, user_id: OTHER_ID, week_start: '2026-09-07' }])).toBeNull();
    expect(parseWeeklyRanking([{ ...entry, place: 0 }])).toBeNull();
  });
});

describe('progresso e registro de treino', () => {
  const progress = {
    total_glory: 93,
    week_glory: 15,
    week_start: '2026-09-14',
    week_scored_workouts: 1,
    last_workout_type: 'corrida',
    last_duration_min: 30,
    last_intensity: 'moderado',
  };

  it('converte o progresso com e sem último treino', () => {
    expect(parseMyProgress([progress])?.lastWorkout).toEqual({ type: 'corrida', durationMin: 30, intensity: 'moderado' });
    expect(
      parseMyProgress([{ ...progress, last_workout_type: null, last_duration_min: null, last_intensity: null }])?.lastWorkout,
    ).toBeNull();
  });

  it('ignora só a sugestão quando o tipo do último treino deixou de existir', () => {
    expect(parseMyProgress([{ ...progress, last_workout_type: 'pilates' }])?.lastWorkout).toBeNull();
    expect(parseMyProgress([{ ...progress, last_duration_min: 0 }])).toBeNull();
    expect(parseMyProgress([{ ...progress, total_glory: 1.5 }])).toBeNull();
  });

  const logged = {
    workout_id: ID,
    presence_points: 10,
    duration_points: 5,
    intensity_points: 2,
    bonus_points: 10,
    points: 27,
    is_scored: true,
    week_glory: 61,
    total_glory: 120,
    replayed: false,
  };

  it('converte o treino registrado e confere a soma da Glória', () => {
    expect(parseLoggedWorkout([logged])).toEqual({
      workoutId: ID,
      presence: 10,
      duration: 5,
      intensity: 2,
      bonus: 10,
      points: 27,
      isScored: true,
      weekGlory: 61,
      totalGlory: 120,
      replayed: false,
    });
    expect(parseLoggedWorkout([{ ...logged, points: 30 }])).toBeNull();
    expect(parseLoggedWorkout([{ ...logged, total_glory: 10 }])).toBeNull();
    expect(parseLoggedWorkout([])).toBeNull();
  });
});
