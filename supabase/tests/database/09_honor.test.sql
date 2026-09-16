-- Séries, recordes por exercício e Honra.
-- A regra que mais importa aqui: Honra nunca vira Glória, e Glória nunca vira Honra.

select tests.create_member('tania', 'Tânia', 'leao');
select tests.create_member('vitor', 'Vitor', 'touro');

select tests.authenticate_as('tania');

-- caso: treino de força grava as séries e a Glória continua sendo a da regra v1
select tests.remember(
  'treino1',
  (
    select (r.resposta -> 'workout' ->> 'workout_id')
    from (
      select public.log_strength_workout(
        gen_random_uuid(),
        'musculacao',
        60,
        'intenso',
        jsonb_build_array(
          jsonb_build_object('exercise_id', 'supino-reto-barra', 'reps', 10, 'load_kg', 60),
          jsonb_build_object('exercise_id', 'supino-reto-barra', 'reps', 8, 'load_kg', 70),
          jsonb_build_object('exercise_id', 'agachamento-livre', 'reps', 5, 'load_kg', 100)
        )
      ) as resposta
    ) as r
  )
);
select tests.assert_equal(
  'as três séries ficaram gravadas na ordem',
  (
    select string_agg(format('%s:%s:%s', s.position, s.exercise_id, s.reps), ' ' order by s.position)
    from public.workout_sets as s
    where s.workout_id = tests.recall('treino1')::uuid
  ),
  '1:supino-reto-barra:10 2:supino-reto-barra:8 3:agachamento-livre:5'
);
select tests.assert_equal(
  'a Glória é a da regra v1: presença 10 + duração 6 + intenso 4',
  (select w.points::integer from public.workouts as w where w.id = tests.recall('treino1')::uuid),
  20
);

-- caso: o primeiro treino cria o recorde, sem render Honra de recorde
select tests.assert_equal(
  'recorde do supino pela estimativa de Epley (70 x (1 + 8/30))',
  (
    select format('%s|%s|%s', r.best_load_kg, r.best_reps, r.best_e1rm)
    from public.exercise_records as r
    where r.user_id = tests.user_id('tania') and r.exercise_id = 'supino-reto-barra'
  ),
  '70.0|10|88.67'
);
select tests.assert_equal(
  'Honra do primeiro dia: 3 por exercício, nada de recorde',
  (
    select string_agg(format('%s=%s', h.exercise_id, h.points), ', ' order by h.exercise_id)
    from public.honor as h
    where h.user_id = tests.user_id('tania') and h.exercise_id is not null
  ),
  'agachamento-livre=3, supino-reto-barra=3'
);
select tests.assert_equal(
  'a modalidade também rendeu 3 de Honra',
  (
    select h.points from public.honor as h
    where h.user_id = tests.user_id('tania') and h.workout_type = 'musculacao'
  ),
  3
);

-- caso: repetir o mesmo exercício no mesmo dia não rende Honra de novo
select public.log_strength_workout(
  gen_random_uuid(),
  'musculacao',
  30,
  'leve',
  jsonb_build_array(jsonb_build_object('exercise_id', 'supino-reto-barra', 'reps', 10, 'load_kg', 40))
);
select tests.assert_equal(
  'a Honra do supino continua em 3 no mesmo dia',
  (
    select h.points from public.honor as h
    where h.user_id = tests.user_id('tania') and h.exercise_id = 'supino-reto-barra'
  ),
  3
);
select tests.assert_equal(
  'carga menor não derruba o recorde',
  (
    select r.best_load_kg from public.exercise_records as r
    where r.user_id = tests.user_id('tania') and r.exercise_id = 'supino-reto-barra'
  ),
  70.0
);

-- caso: bater o recorde rende Honra e aparece na resposta
select tests.remember(
  'recordes',
  (
    select (r.resposta ->> 'records')
    from (
      select public.log_strength_workout(
        gen_random_uuid(),
        'musculacao',
        45,
        'moderado',
        jsonb_build_array(jsonb_build_object('exercise_id', 'supino-reto-barra', 'reps', 8, 'load_kg', 80)),
        now() - interval '30 hours'
      ) as resposta
    ) as r
  )
);
select tests.assert_true(
  'a resposta anuncia o recorde de supino',
  tests.recall('recordes')::jsonb @> '[{"exercise_id": "supino-reto-barra", "kind": "e1rm"}]'::jsonb
);
select tests.assert_equal(
  'Honra do supino: 3 do dia novo + 7 do recorde',
  (
    select h.points from public.honor as h
    where h.user_id = tests.user_id('tania') and h.exercise_id = 'supino-reto-barra'
  ),
  13
);

-- caso: my_honor traz nível e nome, só do próprio usuário
select tests.assert_equal(
  'nível de Honra do supino',
  (
    select format('%s (%s pontos, nível %s)', h.exercise_name, h.points, h.level_name)
    from public.my_honor() as h
    where h.exercise_id = 'supino-reto-barra'
  ),
  'Supino reto com barra (13 pontos, nível Aprendiz)'
);

-- caso: listas malformadas são recusadas e não gravam nada
select tests.assert_raises(
  'série sem repetições',
  $$select public.log_strength_workout(gen_random_uuid(), 'musculacao', 30, 'leve',
      jsonb_build_array(jsonb_build_object('exercise_id', 'supino-reto-barra', 'load_kg', 40)))$$,
  'invalid_sets_list'
);
select tests.assert_raises(
  'carga fora do passo de meio quilo',
  $$select public.log_strength_workout(gen_random_uuid(), 'musculacao', 30, 'leve',
      jsonb_build_array(jsonb_build_object('exercise_id', 'supino-reto-barra', 'reps', 5, 'load_kg', 40.2)))$$,
  'invalid_sets_list'
);
select tests.assert_raises(
  'lista vazia',
  $$select public.log_strength_workout(gen_random_uuid(), 'musculacao', 30, 'leve', '[]'::jsonb)$$,
  'invalid_sets_list'
);
select tests.assert_raises(
  'séries em modalidade de resistência',
  $$select public.log_strength_workout(gen_random_uuid(), 'corrida', 30, 'leve',
      jsonb_build_array(jsonb_build_object('exercise_id', 'supino-reto-barra', 'reps', 5, 'load_kg', 40)))$$,
  'sets_not_allowed'
);
select tests.assert_raises(
  'ficha de outra pessoa',
  $$select public.log_strength_workout(gen_random_uuid(), 'musculacao', 30, 'leve',
      jsonb_build_array(jsonb_build_object('exercise_id', 'supino-reto-barra', 'reps', 5, 'load_kg', 40)),
      null, gen_random_uuid())$$,
  'routine_not_found'
);

-- caso: reenviar o mesmo registro não grava série nem Honra de novo
select tests.remember('pedido_forca', gen_random_uuid()::text);
select public.log_strength_workout(
  tests.recall('pedido_forca')::uuid,
  'musculacao',
  40,
  'leve',
  jsonb_build_array(jsonb_build_object('exercise_id', 'rosca-direta', 'reps', 12, 'load_kg', 20)),
  now() - interval '40 hours'
);
select tests.remember(
  'honra_rosca',
  (select h.points::text from public.honor as h where h.user_id = tests.user_id('tania') and h.exercise_id = 'rosca-direta')
);
select public.log_strength_workout(
  tests.recall('pedido_forca')::uuid,
  'musculacao',
  40,
  'leve',
  jsonb_build_array(jsonb_build_object('exercise_id', 'rosca-direta', 'reps', 12, 'load_kg', 20)),
  now() - interval '40 hours'
);
select tests.assert_equal(
  'o reenvio não soma Honra',
  (select h.points::text from public.honor as h where h.user_id = tests.user_id('tania') and h.exercise_id = 'rosca-direta'),
  tests.recall('honra_rosca')
);
select tests.assert_equal(
  'e não duplica as séries',
  (
    select count(*)::integer
    from public.workout_sets as s
    join public.workouts as w on w.id = s.workout_id
    where w.user_id = tests.user_id('tania') and s.exercise_id = 'rosca-direta'
  ),
  1
);

-- caso: Honra de modalidade também vale para resistência, com recorde de distância
select public.log_workout(gen_random_uuid(), 'corrida', 30, 'leve', now() - interval '20 hours', 5000);
select public.log_workout(gen_random_uuid(), 'corrida', 60, 'leve', now() - interval '44 hours', 10000);
select tests.assert_equal(
  'Honra da corrida: 3 + 3 pelos dois dias, mais 7 do recorde',
  (
    select h.points from public.honor as h
    where h.user_id = tests.user_id('tania') and h.workout_type = 'corrida'
  ),
  13
);
select tests.clear_authentication();

-- caso: Honra e séries são privadas
select tests.authenticate_as('vitor');
select tests.assert_equal(
  'Vitor não vê a Honra da Tânia',
  (select count(*)::integer from public.honor),
  0
);
select tests.assert_equal(
  'Vitor não vê as séries da Tânia',
  (select count(*)::integer from public.workout_sets),
  0
);
select tests.assert_equal(
  'Vitor não vê os recordes da Tânia',
  (select count(*)::integer from public.exercise_records),
  0
);
select tests.assert_equal('e my_honor devolve vazio', (select count(*)::integer from public.my_honor()), 0);
select tests.clear_authentication();

-- caso: Honra não entra na Arena
select tests.create_legion('ginasio', 'Ginásio', array['tania', 'vitor']);
select tests.authenticate_as('vitor');
select tests.assert_equal(
  'a Arena mostra Glória, não Honra',
  (
    select string_agg(format('%s=%s', a.display_name, a.total_glory), ', ' order by a.display_name)
    from public.group_weekly_ranking(tests.recall('ginasio')::uuid, 0) as a
  ),
  -- Tânia: 20 + 13 + 16 + 14 de força, 13 + 16 de corrida e +10 de constância = 102 de Glória.
  -- Nenhum ponto de Honra (13 no supino, 13 na corrida) entrou nessa conta.
  'Tânia=102, Vitor=0'
);
select tests.clear_authentication();

-- caso: medida de saúde só entra com consentimento específico, e sair apaga o que já entrou
select tests.authenticate_as('vitor');
select tests.assert_raises(
  'sem consentimento, a frequência cardíaca é recusada',
  $$select * from public.log_workout(gen_random_uuid(), 'corrida', 30, 'leve', null, 5000, null, null, 150)$$,
  'health_consent_required'
);
select tests.assert_equal(
  'e o treino inteiro não foi gravado',
  (select count(*)::integer from public.workouts where user_id = tests.user_id('vitor')),
  0
);
select tests.assert_true('consentir devolve a data', (select public.set_health_consent(true)) is not null);
select public.log_workout(gen_random_uuid(), 'corrida', 30, 'leve', null, 5000, null, null, 150, 175);
select tests.assert_equal(
  'com consentimento, a medida é guardada',
  (select format('%s/%s', w.avg_heart_rate, w.max_heart_rate) from public.workouts as w where w.user_id = tests.user_id('vitor')),
  '150/175'
);
select tests.assert_raises(
  'média maior que a máxima é recusada',
  $$select * from public.log_workout(gen_random_uuid(), 'corrida', 30, 'leve', null, null, null, null, 180, 150)$$,
  'invalid_heart_rate'
);
select tests.assert_raises(
  'batimento fora da faixa humana',
  $$select * from public.log_workout(gen_random_uuid(), 'corrida', 30, 'leve', null, null, null, null, 400)$$,
  'invalid_heart_rate'
);
select tests.assert_true('retirar o consentimento devolve nulo', (select public.set_health_consent(false)) is null);
select tests.assert_equal(
  'retirar o consentimento apaga as medidas já guardadas',
  (
    select count(*)::integer from public.workouts as w
    where w.user_id = tests.user_id('vitor') and (w.avg_heart_rate is not null or w.max_heart_rate is not null)
  ),
  0
);
select tests.assert_equal(
  'mas o treino em si continua no histórico',
  (select count(*)::integer from public.workouts where user_id = tests.user_id('vitor')),
  1
);
select tests.clear_authentication();
