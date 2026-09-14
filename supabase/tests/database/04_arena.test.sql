-- RF008 Arena semanal · RF009 só membros veem · RF010 Glória acumulada e progresso.
-- Os treinos são registrados em relação à semana corrente do servidor, para valer em qualquer data.

select tests.create_member('ana', 'Ana', 'aguia');
select tests.create_member('bruno', 'Bruno', 'leao');
select tests.create_member('carla', 'Carla', 'coruja');
select tests.create_member('diego', 'Diego', 'raio');
select tests.create_member('eva', 'Eva', 'loba');
select tests.create_legion('arena', 'Legião da Arena', array['ana', 'bruno', 'carla', 'diego']);

-- Semana corrente: Ana 40 · Bruno 34 · Carla 34 · Diego 0. Semana anterior: Diego 70 · Ana 17.
do $$
declare
  v_monday constant timestamptz := private.week_start(now())::timestamp at time zone 'America/Sao_Paulo';
  v_previous_monday constant timestamptz := v_monday - interval '7 days';
begin
  perform private.log_workout_for(tests.user_id('ana'), v_previous_monday + interval '10 hours 5 minutes', gen_random_uuid(), 'corrida', 50, 'moderado', v_previous_monday + interval '10 hours');
  perform private.log_workout_for(tests.user_id('diego'), v_previous_monday + interval '10 hours 5 minutes', gen_random_uuid(), 'musculacao', 60, 'intenso', v_previous_monday + interval '10 hours');
  perform private.log_workout_for(tests.user_id('diego'), v_previous_monday + interval '34 hours 5 minutes', gen_random_uuid(), 'musculacao', 60, 'intenso', v_previous_monday + interval '34 hours');
  perform private.log_workout_for(tests.user_id('diego'), v_previous_monday + interval '58 hours 5 minutes', gen_random_uuid(), 'musculacao', 60, 'intenso', v_previous_monday + interval '58 hours');

  perform private.log_workout_for(tests.user_id('ana'), v_monday + interval '8 hours 5 minutes', gen_random_uuid(), 'bike', 60, 'intenso', v_monday + interval '8 hours');
  perform private.log_workout_for(tests.user_id('ana'), v_monday + interval '9 hours 5 minutes', gen_random_uuid(), 'bike', 60, 'intenso', v_monday + interval '9 hours');
  perform private.log_workout_for(tests.user_id('bruno'), v_monday + interval '8 hours 5 minutes', gen_random_uuid(), 'corrida', 50, 'moderado', v_monday + interval '8 hours');
  perform private.log_workout_for(tests.user_id('bruno'), v_monday + interval '9 hours 5 minutes', gen_random_uuid(), 'corrida', 50, 'moderado', v_monday + interval '9 hours');
  perform private.log_workout_for(tests.user_id('carla'), v_monday + interval '8 hours 5 minutes', gen_random_uuid(), 'musculacao', 60, 'intenso', v_monday + interval '8 hours');
  perform private.log_workout_for(tests.user_id('carla'), v_monday + interval '9 hours 5 minutes', gen_random_uuid(), 'caminhada', 40, 'leve', v_monday + interval '9 hours');
end;
$$;

-- caso: classificação da semana com empates dividindo a posição
select tests.authenticate_as('bruno');
select tests.assert_equal(
  'posições',
  (
    select string_agg(format('%s:%s:%s', r.place, r.display_name, r.week_glory), ', ' order by r.place, r.display_name)
    from public.group_weekly_ranking(tests.recall('arena')::uuid) as r
  ),
  '1:Ana:40, 2:Bruno:34, 2:Carla:34, 4:Diego:0'
);
select tests.assert_equal(
  'só o próprio usuário marcado',
  (
    select string_agg(r.display_name, ', ')
    from public.group_weekly_ranking(tests.recall('arena')::uuid) as r
    where r.is_me
  ),
  'Bruno'
);
select tests.assert_equal(
  'semana informada',
  (select distinct r.week_start from public.group_weekly_ranking(tests.recall('arena')::uuid) as r),
  date_trunc('week', now() at time zone 'America/Sao_Paulo')::date
);
select tests.clear_authentication();

-- caso: semana anterior e Glória acumulada
select tests.authenticate_as('ana');
select tests.assert_equal(
  'posições da semana anterior',
  (
    select string_agg(format('%s:%s:%s', r.place, r.display_name, r.week_glory), ', ' order by r.place, r.display_name)
    from public.group_weekly_ranking(tests.recall('arena')::uuid, -1) as r
  ),
  '1:Diego:70, 2:Ana:17, 3:Bruno:0, 3:Carla:0'
);
select tests.assert_equal(
  'Glória acumulada soma todas as semanas',
  (
    select string_agg(format('%s:%s', r.display_name, r.total_glory), ', ' order by r.display_name)
    from public.group_weekly_ranking(tests.recall('arena')::uuid) as r
  ),
  'Ana:57, Bruno:34, Carla:34, Diego:70'
);
select tests.clear_authentication();

-- caso: quem está fora não vê a Arena, e só existem as semanas corrente e anterior
select tests.authenticate_as('eva');
select tests.assert_raises(
  'Eva, de fora',
  format('select * from public.group_weekly_ranking(%L)', tests.recall('arena')),
  'not_a_member'
);
select tests.assert_raises(
  'Legião inexistente',
  format('select * from public.group_weekly_ranking(%L)', gen_random_uuid()),
  'not_a_member'
);
select tests.clear_authentication();
select tests.authenticate_as('ana');
select tests.assert_raises(
  'semana seguinte',
  format('select * from public.group_weekly_ranking(%L, 1)', tests.recall('arena')),
  'invalid_week_offset'
);
select tests.assert_raises(
  'duas semanas atrás',
  format('select * from public.group_weekly_ranking(%L, -2)', tests.recall('arena')),
  'invalid_week_offset'
);
select tests.clear_authentication();
select tests.authenticate_as_anon();
select tests.assert_raises(
  'anon',
  format('select * from public.group_weekly_ranking(%L)', tests.recall('arena')),
  'permission denied for function group_weekly_ranking'
);
select tests.clear_authentication();

-- caso: progresso pessoal com o último treino para "Repetir último"
select tests.authenticate_as('carla');
select tests.assert_equal(
  'progresso da Carla',
  (
    select format(
      'acumulada %s, semana %s, pontuados %s, último %s %s min %s',
      p.total_glory, p.week_glory, p.week_scored_workouts, p.last_workout_type, p.last_duration_min, p.last_intensity
    )
    from public.my_progress() as p
  ),
  'acumulada 34, semana 34, pontuados 2, último caminhada 40 min leve'
);
select tests.clear_authentication();
select tests.authenticate_as('eva');
select tests.assert_equal(
  'progresso de quem ainda não treinou',
  (
    select format(
      'acumulada %s, semana %s, pontuados %s, último %s',
      p.total_glory, p.week_glory, p.week_scored_workouts, coalesce(p.last_workout_type, 'nenhum')
    )
    from public.my_progress() as p
  ),
  'acumulada 0, semana 0, pontuados 0, último nenhum'
);
select tests.clear_authentication();

-- caso: quem sai da Legião some da Arena
select tests.authenticate_as('diego');
select public.leave_group(tests.recall('arena')::uuid);
select tests.clear_authentication();
select tests.authenticate_as('bruno');
select tests.assert_equal(
  'membros na Arena',
  (select string_agg(r.display_name, ', ' order by r.display_name) from public.group_weekly_ranking(tests.recall('arena')::uuid) as r),
  'Ana, Bruno, Carla'
);
select tests.clear_authentication();
