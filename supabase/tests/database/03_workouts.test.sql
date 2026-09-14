-- RF006 registrar treino · RF007 pontuação no servidor · NF007 idempotência · NF010 sem gravação direta.
-- Os casos de regra usam o núcleo private.log_workout_for com um "agora" fixo (semana de 14/09/2026).

select tests.create_user('sem_perfil');
select tests.create_member('camila', 'Camila', 'coruja');
select tests.create_member('lucas', 'Lucas', 'aguia');
select tests.create_member('digao', 'Digão', 'raio');
select tests.create_member('rita', 'Rita', 'loba');
select tests.create_member('noturno', 'Noturno', 'pegaso');
select tests.create_member('atrasado', 'Atrasado', 'elmo');
select tests.create_member('repete', 'Repete', 'leao');
select tests.create_member('valida', 'Valida', 'tridente');
select tests.create_member('spam', 'Spam', 'raio');
select tests.create_member('maria', 'Maria', 'coruja');

create function tests.log_at(
  p_user text,
  p_now timestamptz,
  p_type text,
  p_duration integer,
  p_intensity text,
  p_performed_at timestamptz default null,
  p_request_id uuid default gen_random_uuid()
)
returns table (
  workout_id uuid,
  presence_points integer,
  duration_points integer,
  intensity_points integer,
  bonus_points integer,
  points integer,
  is_scored boolean,
  week_glory integer,
  total_glory integer,
  replayed boolean
)
language sql
as $$
  select * from private.log_workout_for(
    tests.user_id(p_user), p_now, p_request_id, p_type, p_duration, p_intensity, p_performed_at
  );
$$;

-- caso: Glória de um treino pela regra v1 (tabela de casos)
select tests.assert_equal(
  format('%s min, %s', c.duration, c.intensity),
  (
    select wp.presence + wp.duration + wp.intensity
    from private.workout_points_v1(c.duration, c.intensity) as wp
  ),
  c.expected
)
from (
  values
    (1, 'leve', 10),
    (9, 'leve', 10),
    (10, 'leve', 11),
    (40, 'leve', 14),
    (50, 'moderado', 17),
    (59, 'moderado', 17),
    (60, 'intenso', 20),
    (70, 'intenso', 20),
    (300, 'intenso', 20)
) as c (duration, intensity, expected);

-- caso: semana da Camila (3 treinos leves de 40 min) vale 52
select tests.log_at('camila', '2026-09-14 11:00Z', 'caminhada', 40, 'leve', '2026-09-14 10:00Z');
select tests.log_at('camila', '2026-09-16 11:00Z', 'caminhada', 40, 'leve', '2026-09-16 10:00Z');
select tests.assert_equal(
  'terceiro treino da semana',
  (
    select format(
      'presença %s, duração %s, intensidade %s, bônus %s, total %s, semana %s',
      r.presence_points, r.duration_points, r.intensity_points, r.bonus_points, r.points, r.week_glory
    )
    from tests.log_at('camila', '2026-09-18 11:00Z', 'caminhada', 40, 'leve', '2026-09-18 10:00Z') as r
  ),
  'presença 10, duração 4, intensidade 0, bônus 10, total 24, semana 52'
);

-- caso: semana do Lucas (4 treinos moderados de 50 min) vale 78
do $$
begin
  for day in 0..3 loop
    perform tests.log_at(
      'lucas',
      timestamptz '2026-09-14 22:00Z' + day * interval '1 day' + interval '30 minutes',
      'musculacao', 50, 'moderado',
      timestamptz '2026-09-14 22:00Z' + day * interval '1 day'
    );
  end loop;
end;
$$;
select tests.assert_equal(
  'Glória de cada treino',
  (select string_agg(points::text, ', ' order by performed_at) from public.workouts where user_id = tests.user_id('lucas')),
  '17, 17, 27, 17'
);
select tests.assert_equal(
  'Glória da semana',
  (select sum(points)::integer from public.workouts where user_id = tests.user_id('lucas') and week_start = '2026-09-14'),
  78
);

-- caso: semana do Digão (6 treinos intensos de 70 min) vale 130
do $$
begin
  for day in 0..5 loop
    perform tests.log_at(
      'digao',
      timestamptz '2026-09-14 09:00Z' + day * interval '1 day' + interval '2 hours',
      'musculacao', 70, 'intenso',
      timestamptz '2026-09-14 09:00Z' + day * interval '1 day'
    );
  end loop;
end;
$$;
select tests.assert_equal(
  'Glória de cada treino',
  (select string_agg(points::text, ', ' order by performed_at) from public.workouts where user_id = tests.user_id('digao')),
  '20, 20, 30, 20, 20, 20'
);
select tests.assert_equal(
  'Glória da semana',
  (select sum(points)::integer from public.workouts where user_id = tests.user_id('digao')),
  130
);

-- caso: no máximo 2 treinos pontuados por dia, e o excedente não conta para o bônus
select tests.log_at('rita', '2026-09-14 12:10Z', 'corrida', 50, 'moderado', '2026-09-14 12:00Z');
select tests.log_at('rita', '2026-09-14 15:10Z', 'corrida', 50, 'moderado', '2026-09-14 15:00Z');
select tests.assert_equal(
  'terceiro treino do dia',
  (
    select format('pontuado %s, total %s', r.is_scored, r.points)
    from tests.log_at('rita', '2026-09-14 21:10Z', 'corrida', 50, 'moderado', '2026-09-14 21:00Z') as r
  ),
  'pontuado f, total 0'
);
select tests.assert_equal(
  'no dia seguinte vem o 3º pontuado da semana, com bônus',
  (
    select format('pontuado %s, bônus %s, semana %s', r.is_scored, r.bonus_points, r.week_glory)
    from tests.log_at('rita', '2026-09-15 12:10Z', 'corrida', 50, 'moderado', '2026-09-15 12:00Z') as r
  ),
  'pontuado t, bônus 10, semana 61'
);

-- caso: dia e semana contam no horário de São Paulo, qualquer que seja o fuso da sessão
set local timezone = 'Asia/Tokyo';
select tests.log_at('noturno', '2026-09-21 03:00Z', 'yoga', 30, 'leve', '2026-09-21 02:30Z');
select tests.log_at('noturno', '2026-09-21 04:00Z', 'yoga', 30, 'leve', '2026-09-21 03:30Z');
set local timezone = 'UTC';
select tests.assert_equal(
  'domingo 23h30 e segunda 00h30 em São Paulo',
  (
    select string_agg(format('%s/%s', local_date, week_start), ', ' order by performed_at)
    from public.workouts
    where user_id = tests.user_id('noturno')
  ),
  '2026-09-20/2026-09-14, 2026-09-21/2026-09-21'
);

-- caso: lançamento até 48 horas depois e nunca no futuro
select tests.log_at('atrasado', '2026-09-17 15:00Z', 'bike', 30, 'leve', timestamptz '2026-09-17 15:00Z' - interval '47 hours 59 minutes');
select tests.assert_raises(
  '48 horas e 1 minuto antes',
  $$select * from tests.log_at('atrasado', '2026-09-17 15:00Z', 'bike', 30, 'leve', timestamptz '2026-09-17 15:00Z' - interval '48 hours 1 minute')$$,
  'performed_at_too_old'
);
select tests.assert_raises(
  '6 minutos no futuro',
  $$select * from tests.log_at('atrasado', '2026-09-17 15:00Z', 'bike', 30, 'leve', '2026-09-17 15:06Z')$$,
  'performed_at_in_future'
);
select tests.log_at('atrasado', '2026-09-17 15:00Z', 'bike', 30, 'leve', '2026-09-17 15:03Z');
select tests.log_at('atrasado', '2026-09-17 16:00Z', 'bike', 30, 'leve');
select tests.assert_equal(
  'relógio adiantado em 3 min é gravado como agora; sem data, vale o agora',
  (
    select string_agg(to_char(performed_at at time zone 'UTC', 'DD HH24:MI'), ', ' order by performed_at)
    from public.workouts
    where user_id = tests.user_id('atrasado')
  ),
  '15 15:01, 17 15:00, 17 16:00'
);

-- caso: reenviar o mesmo registro não pontua de novo
select tests.remember('pedido', gen_random_uuid()::text);
select tests.remember(
  'primeiro',
  (
    select format('%s|%s', r.workout_id, r.points)
    from tests.log_at('repete', '2026-09-15 12:00Z', 'natacao', 45, 'intenso', null, tests.recall('pedido')::uuid) as r
  )
);
select tests.assert_equal(
  'reenvio devolve o registro original',
  (
    select format('%s|%s|%s', r.workout_id, r.points, r.replayed)
    from tests.log_at('repete', '2026-09-15 12:01Z', 'natacao', 45, 'intenso', null, tests.recall('pedido')::uuid) as r
  ),
  tests.recall('primeiro') || '|t'
);
select tests.assert_equal(
  'um só treino gravado',
  (select count(*)::integer from public.workouts where user_id = tests.user_id('repete')),
  1
);
select tests.assert_raises(
  'mesmo identificador com outros dados',
  format(
    $$select * from tests.log_at('repete', '2026-09-15 12:02Z', 'natacao', 30, 'intenso', null, %L)$$,
    tests.recall('pedido')
  ),
  'request_id_conflict'
);

-- caso: campos fora da lista ou dos limites são recusados
select tests.assert_raises(
  'tipo desconhecido',
  $$select * from tests.log_at('valida', '2026-09-15 12:00Z', 'pilates', 30, 'leve')$$,
  'invalid_workout_type'
);
update public.workout_types set is_active = false where id = 'outro';
select tests.assert_raises(
  'tipo desativado',
  $$select * from tests.log_at('valida', '2026-09-15 12:00Z', 'outro', 30, 'leve')$$,
  'invalid_workout_type'
);
update public.workout_types set is_active = true where id = 'outro';
select tests.assert_raises(
  'duração 0',
  $$select * from tests.log_at('valida', '2026-09-15 12:00Z', 'corrida', 0, 'leve')$$,
  'invalid_duration'
);
select tests.assert_raises(
  'duração 301',
  $$select * from tests.log_at('valida', '2026-09-15 12:00Z', 'corrida', 301, 'leve')$$,
  'invalid_duration'
);
select tests.assert_raises(
  'duração nula',
  $$select * from tests.log_at('valida', '2026-09-15 12:00Z', 'corrida', null, 'leve')$$,
  'invalid_duration'
);
select tests.assert_raises(
  'intensidade desconhecida',
  $$select * from tests.log_at('valida', '2026-09-15 12:00Z', 'corrida', 30, 'extremo')$$,
  'invalid_intensity'
);
select tests.assert_raises(
  'identificador do pedido nulo',
  $$select * from private.log_workout_for(tests.user_id('valida'), '2026-09-15 12:00Z', null, 'corrida', 30, 'leve', null)$$,
  'invalid_request_id'
);
select tests.assert_raises(
  'sem usuário',
  $$select * from private.log_workout_for(null, '2026-09-15 12:00Z', gen_random_uuid(), 'corrida', 30, 'leve', null)$$,
  'not_authenticated'
);
select tests.assert_raises(
  'usuário sem perfil',
  $$select * from tests.log_at('sem_perfil', '2026-09-15 12:00Z', 'corrida', 30, 'leve')$$,
  'profile_required'
);
select tests.assert_equal(
  'nada gravado',
  (select count(*)::integer from public.workouts where user_id = tests.user_id('valida')),
  0
);

-- caso: no máximo 20 registros em 24 horas
do $$
begin
  for n in 1..20 loop
    perform tests.log_at('spam', '2026-09-16 12:00Z', 'outro', 10, 'leve', timestamptz '2026-09-16 12:00Z' - n * interval '1 minute');
  end loop;
end;
$$;
select tests.assert_raises(
  '21º registro',
  $$select * from tests.log_at('spam', '2026-09-16 12:00Z', 'outro', 10, 'leve')$$,
  'rate_limited'
);

-- caso: pela API, o usuário registra com o relógio do servidor
select tests.authenticate_as('maria');
select tests.assert_equal(
  'corrida moderada de 30 min',
  (
    select format('total %s, semana %s, acumulada %s, reenvio %s', r.points, r.week_glory, r.total_glory, r.replayed)
    from public.log_workout(gen_random_uuid(), 'corrida', 30, 'moderado') as r
  ),
  'total 15, semana 15, acumulada 15, reenvio f'
);
select tests.clear_authentication();
select tests.authenticate_as('sem_perfil');
select tests.assert_raises(
  'sem perfil',
  $$select * from public.log_workout(gen_random_uuid(), 'corrida', 30, 'moderado')$$,
  'profile_required'
);
select tests.clear_authentication();
select tests.authenticate_as_anon();
select tests.assert_raises(
  'anon',
  $$select * from public.log_workout(gen_random_uuid(), 'corrida', 30, 'moderado')$$,
  'permission denied for function log_workout'
);
select tests.clear_authentication();

-- caso: o app não grava treinos nem altera pontos direto na tabela
select tests.authenticate_as('maria');
select tests.assert_raises(
  'insert direto',
  $$insert into public.workouts (user_id, client_request_id, workout_type, duration_min, intensity, performed_at, local_date, week_start, is_scored, presence_points, duration_points, intensity_points, bonus_points, scoring_version)
    values (auth.uid(), gen_random_uuid(), 'corrida', 30, 'intenso', now(), current_date, current_date, true, 10, 6, 4, 10, 1)$$,
  'permission denied for table workouts'
);
select tests.assert_raises(
  'inflar bônus',
  $$update public.workouts set bonus_points = 10$$,
  'permission denied for table workouts'
);
select tests.assert_raises('apagar treinos', $$delete from public.workouts$$, 'permission denied for table workouts');
select tests.clear_authentication();

-- caso: cada usuário lê só os próprios treinos
select tests.authenticate_as('camila');
select tests.assert_equal('treinos visíveis para a Camila', (select count(*)::integer from public.workouts), 3);
select tests.assert_equal(
  'treinos do Lucas, buscados pelo id',
  (select count(*)::integer from public.workouts where user_id = tests.user_id('lucas')),
  0
);
select tests.clear_authentication();
