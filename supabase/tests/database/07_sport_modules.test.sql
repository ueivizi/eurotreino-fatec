-- Módulos por esporte: cada modalidade aceita só os detalhes da sua família, e os detalhes nunca
-- mexem na Glória. O "agora" é fixo (semana de 14/09/2026), como nos testes de registro.

select tests.create_member('atleta', 'Atleta', 'aguia');
select tests.create_member('forte', 'Forte', 'leao');
select tests.create_member('faixa', 'Faixa', 'loba');

create function tests.log_detailed(
  p_user text,
  p_now timestamptz,
  p_type text,
  p_duration integer,
  p_intensity text,
  p_distance_m integer default null,
  p_sets_count integer default null,
  p_load_kg numeric default null
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
  replayed boolean,
  is_distance_record boolean
)
language sql
as $$
  select * from private.log_workout_for(
    tests.user_id(p_user), p_now, gen_random_uuid(), p_type, p_duration, p_intensity, null,
    p_distance_m, p_sets_count, p_load_kg
  );
$$;

-- caso: cada modalidade está na família certa
select tests.assert_equal(
  'famílias das modalidades',
  (
    select string_agg(wt.id || '=' || wt.module, ', ' order by wt.sort_order)
    from public.workout_types as wt
  ),
  'musculacao=forca, corrida=resistencia, caminhada=resistencia, bike=resistencia, natacao=resistencia, '
    || 'funcional=forca, esporte=outro, yoga=outro, outro=outro'
);

-- caso: a distância não muda a Glória
select tests.assert_equal(
  'corrida de 30 min moderada, com e sem distância',
  (
    select format('%s|%s',
      (select r.points from tests.log_detailed('atleta', '2026-09-14 08:00Z', 'corrida', 30, 'moderado') as r),
      (select r.points from tests.log_detailed('atleta', '2026-09-14 20:00Z', 'corrida', 30, 'moderado', 7000) as r)
    )
  ),
  '15|15'
);

-- caso: o primeiro treino com distância não é recorde; o seguinte, maior, é
select tests.assert_equal(
  'recorde só a partir do segundo',
  (
    select format('%s|%s',
      (select r.is_distance_record from tests.log_detailed('faixa', '2026-09-15 08:00Z', 'corrida', 30, 'leve', 5000) as r),
      (select r.is_distance_record from tests.log_detailed('faixa', '2026-09-16 08:00Z', 'corrida', 60, 'leve', 10000) as r)
    )
  ),
  'f|t'
);
select tests.assert_equal(
  'distância menor não é recorde, e o recorde é por modalidade',
  (
    select format('%s|%s',
      (select r.is_distance_record from tests.log_detailed('faixa', '2026-09-17 08:00Z', 'corrida', 20, 'leve', 3000) as r),
      (select r.is_distance_record from tests.log_detailed('faixa', '2026-09-18 08:00Z', 'bike', 20, 'leve', 9000) as r)
    )
  ),
  'f|f'
);

-- caso: detalhe fora da família da modalidade é recusado
select tests.assert_raises(
  'distância em musculação',
  $$select * from tests.log_detailed('forte', '2026-09-15 12:00Z', 'musculacao', 60, 'intenso', 5000)$$,
  'distance_not_allowed'
);
select tests.assert_raises(
  'séries em corrida',
  $$select * from tests.log_detailed('forte', '2026-09-15 12:00Z', 'corrida', 60, 'intenso', null, 4)$$,
  'strength_not_allowed'
);
select tests.assert_raises(
  'carga em yoga',
  $$select * from tests.log_detailed('forte', '2026-09-15 12:00Z', 'yoga', 60, 'leve', null, null, 20)$$,
  'strength_not_allowed'
);

-- caso: faixas dos detalhes
select tests.assert_raises(
  'distância de 9 metros',
  $$select * from tests.log_detailed('forte', '2026-09-15 12:00Z', 'corrida', 30, 'leve', 9)$$,
  'invalid_distance'
);
select tests.assert_raises(
  'distância acima de 200 km',
  $$select * from tests.log_detailed('forte', '2026-09-15 12:00Z', 'bike', 30, 'leve', 200001)$$,
  'invalid_distance'
);
select tests.assert_raises(
  'zero séries',
  $$select * from tests.log_detailed('forte', '2026-09-15 12:00Z', 'musculacao', 30, 'leve', null, 0)$$,
  'invalid_sets'
);
select tests.assert_raises(
  'carga de 0,3 kg (fora do passo de meio quilo)',
  $$select * from tests.log_detailed('forte', '2026-09-15 12:00Z', 'musculacao', 30, 'leve', null, null, 0.3)$$,
  'invalid_load'
);
select tests.assert_raises(
  'carga acima de 500 kg',
  $$select * from tests.log_detailed('forte', '2026-09-15 12:00Z', 'musculacao', 30, 'leve', null, null, 500.5)$$,
  'invalid_load'
);
select tests.assert_equal(
  'nenhum detalhe inválido foi gravado',
  (select count(*)::integer from public.workouts where user_id = tests.user_id('forte')),
  0
);

-- caso: reenvio com detalhe diferente é conflito, não repetição
select tests.remember('pedido', gen_random_uuid()::text);
select tests.assert_equal(
  'primeiro envio grava',
  (
    select r.is_distance_record::text
    from private.log_workout_for(
      tests.user_id('forte'), '2026-09-15 12:00Z', tests.recall('pedido')::uuid, 'corrida', 30, 'leve', null, 5000
    ) as r
  ),
  'false'
);
select tests.assert_raises(
  'reenvio com outra distância',
  $$select * from private.log_workout_for(
      tests.user_id('forte'), '2026-09-15 12:05Z', tests.recall('pedido')::uuid, 'corrida', 30, 'leve', null, 9000
    )$$,
  'request_id_conflict'
);
select tests.assert_equal(
  'reenvio idêntico devolve o mesmo treino, sem pontuar de novo',
  (
    select format('%s|%s', r.replayed, r.points)
    from private.log_workout_for(
      tests.user_id('forte'), '2026-09-15 12:05Z', tests.recall('pedido')::uuid, 'corrida', 30, 'leve', null, 5000
    ) as r
  ),
  't|13'
);
select tests.assert_equal(
  'só um treino gravado',
  (select count(*)::integer from public.workouts where user_id = tests.user_id('forte')),
  1
);

-- caso: my_records resume por modalidade, e o ritmo ignora trechos abaixo de 1 km
select tests.authenticate_as('atleta');
select tests.assert_equal(
  'recordes da corrida',
  (
    select format('%s treinos, melhor %s m, total %s m, ritmo %s s/km',
      r.workouts_count, r.best_distance_m, r.total_distance_m, coalesce(r.best_pace_s_per_km::text, '—'))
    from public.my_records() as r
    where r.workout_type = 'corrida'
  ),
  '2 treinos, melhor 7000 m, total 7000 m, ritmo 257 s/km'
);
select tests.clear_authentication();

select tests.authenticate_as('faixa');
select tests.assert_equal(
  'trecho curto não vira recorde de ritmo',
  (
    select coalesce(min(r.best_pace_s_per_km)::text, '—')
    from public.my_records() as r
    where r.workout_type = 'corrida'
  ),
  -- 10 km em 60 min = 360 s/km é melhor que 5 km em 30 min (idem) e que 3 km em 20 min (400).
  '360'
);
select tests.assert_equal(
  'my_records não mistura pessoas',
  (select count(*)::integer from public.my_records() as r where r.workout_type = 'bike'),
  1
);
select tests.clear_authentication();

select tests.authenticate_as_anon();
select tests.assert_raises('anon não lê recordes', $$select * from public.my_records()$$, 'permission denied for function my_records');
select tests.clear_authentication();

-- caso: my_progress devolve os detalhes do último treino, para "Repetir último" recomeçar completo
select tests.create_member('repetidor', 'Repetidor', 'aguia');
select tests.log_detailed('repetidor', '2026-09-14 07:00Z', 'corrida', 40, 'leve', 6000);
select tests.log_detailed('repetidor', '2026-09-15 07:00Z', 'musculacao', 55, 'intenso', null, 18, 62.5);
select tests.authenticate_as('repetidor');
select tests.assert_equal(
  'último treino com os detalhes da família certa',
  (
    select format(
      '%s %s min %s · distância %s · séries %s · carga %s',
      p.last_workout_type, p.last_duration_min, p.last_intensity,
      coalesce(p.last_distance_m::text, '—'),
      coalesce(p.last_sets_count::text, '—'),
      coalesce(p.last_load_kg::text, '—')
    )
    from public.my_progress() as p
  ),
  'musculacao 55 min intenso · distância — · séries 18 · carga 62.5'
);
select tests.clear_authentication();

select tests.create_member('repetidora', 'Repetidora', 'loba');
select tests.log_detailed('repetidora', '2026-09-15 07:00Z', 'corrida', 45, 'moderado', 8100);
select tests.authenticate_as('repetidora');
select tests.assert_equal(
  'último treino de resistência traz a distância e nada de força',
  (
    select format(
      '%s · distância %s · séries %s · carga %s',
      p.last_workout_type,
      coalesce(p.last_distance_m::text, '—'),
      coalesce(p.last_sets_count::text, '—'),
      coalesce(p.last_load_kg::text, '—')
    )
    from public.my_progress() as p
  ),
  'corrida · distância 8100 · séries — · carga —'
);
select tests.clear_authentication();

-- caso: a frequência cardíaca fica fora de propósito -- medida não se repete, e dado sensível
-- que a tela não usa não sai do banco.
select tests.assert_equal(
  'my_progress não devolve medida de saúde',
  (
    select position('heart' in pg_get_function_result(p.oid))::integer
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'my_progress'
  ),
  0
);
