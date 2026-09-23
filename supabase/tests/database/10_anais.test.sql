-- Anais: o histórico do próprio dono, mês a mês.
--
-- Os instantes são ancorados no mês (dia 11 ao meio-dia), e não em "agora menos algumas horas":
-- assim o teste não vira moeda no dia 1º de cada mês. O `p_now` do registro é o mesmo instante do
-- treino, então a janela de 48 h sempre fecha.

select tests.create_member('cronista', 'Cronista', 'coruja');
select tests.create_member('alheio', 'Alheio', 'raio');

create function tests.anais_log(
  p_user text,
  p_at timestamptz,
  p_type text,
  p_duration integer,
  p_intensity text,
  p_distance_m integer default null,
  p_sets integer default null,
  p_load numeric default null
)
returns uuid
language sql
as $$
  select (
    private.log_workout_for(
      tests.user_id(p_user), p_at, gen_random_uuid(), p_type, p_duration, p_intensity, p_at,
      p_distance_m, p_sets, p_load
    )
  ).workout_id;
$$;

-- Dois treinos neste mês e um no mês passado, todos do Cronista.
select tests.anais_log('cronista', date_trunc('month', now()) + interval '11 days 12 hours', 'musculacao', 60, 'intenso', null, 12, 40);
select tests.anais_log('cronista', date_trunc('month', now()) + interval '11 days 18 hours', 'corrida', 30, 'moderado', 5000);
select tests.anais_log('cronista', date_trunc('month', now()) - interval '20 days' + interval '12 hours', 'bike', 50, 'leve', 12000);
select tests.anais_log('alheio', date_trunc('month', now()) + interval '11 days 12 hours', 'corrida', 20, 'leve');

-- caso: os meses vêm do mais recente para o mais antigo, com o total de cada um
select tests.authenticate_as('cronista');
select tests.assert_equal(
  'meses com treino',
  (
    select string_agg(format('%s treinos, %s de Glória', m.workouts_count, m.glory), ' | ' order by m.month desc)
    from public.my_workout_months() as m
  ),
  -- musculação 60 min intenso = 10+6+4; corrida 30 min moderado = 10+3+2; bike 50 min leve = 10+5+0.
  '2 treinos, 35 de Glória | 1 treinos, 15 de Glória'
);

-- caso: o mês corrente traz só os dois deste mês, do mais recente para o mais antigo
select tests.assert_equal(
  'treinos do mês corrente',
  (select string_agg(w.workout_type || '/' || w.module, ', ' order by w.performed_at desc) from public.my_workouts() as w),
  'corrida/resistencia, musculacao/forca'
);

-- caso: o mês pedido é respeitado, e o detalhe da modalidade vem junto
select tests.assert_equal(
  'treino do mês passado, com distância',
  (
    select format('%s %s m, %s pontos', w.workout_type, w.distance_m, w.points)
    from public.my_workouts((date_trunc('month', now()) - interval '20 days')::date) as w
  ),
  'bike 12000 m, 15 pontos'
);

-- caso: a composição da Glória vem inteira, para o detalhe dizer de onde veio cada ponto
select tests.assert_equal(
  'composição do treino de força',
  (
    select format('%s+%s+%s+%s=%s · %s séries · %s kg',
      w.presence_points, w.duration_points, w.intensity_points, w.bonus_points, w.points, w.sets_count, w.load_kg)
    from public.my_workouts() as w
    where w.workout_type = 'musculacao'
  ),
  '10+6+4+0=20 · 12 séries · 40.0 kg'
);
select tests.clear_authentication();

-- caso: Anais são de quem pede, e de mais ninguém
select tests.authenticate_as('alheio');
select tests.assert_equal(
  'o treino do Cronista não aparece para o Alheio',
  (select count(*)::integer from public.my_workouts() as w where w.duration_min <> 20),
  0
);
select tests.assert_equal(
  'os meses também são só os próprios',
  (select coalesce(sum(m.workouts_count), 0)::integer from public.my_workout_months() as m),
  1
);
select tests.clear_authentication();

select tests.authenticate_as_anon();
select tests.assert_raises('anon não lê Anais', $$select * from public.my_workouts()$$, 'permission denied for function my_workouts');
select tests.assert_raises('anon não lê os meses', $$select * from public.my_workout_months()$$, 'permission denied for function my_workout_months');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- Editar um treino (RF014)

select tests.create_member('corretor', 'Corretor', 'aguia');

-- Um treino desta semana (ontem, para não depender da hora) e um de semana fechada.
select tests.remember('corrigivel', tests.anais_log('corretor', now() - interval '20 hours', 'corrida', 30, 'moderado', 5000)::text);
select tests.remember('antigo', tests.anais_log('corretor', now() - interval '20 days', 'bike', 40, 'leve', 9000)::text);

select tests.authenticate_as('corretor');

-- caso: os Anais já dizem qual treino ainda dá para corrigir
select tests.assert_equal(
  'treino da semana corrente é editável',
  (
    select w.can_edit
    from public.my_workouts(date_trunc('month', now() - interval '20 hours')::date) as w
    where w.workout_id = tests.recall('corrigivel')::uuid
  ),
  true
);
select tests.assert_equal(
  'treino de semana fechada não é',
  (
    select w.can_edit
    from public.my_workouts(date_trunc('month', now() - interval '20 days')::date) as w
    where w.workout_id = tests.recall('antigo')::uuid
  ),
  false
);

-- caso: corrigir duração e intensidade recalcula a Glória pela regra v1
select tests.assert_equal(
  'corrigir 30 min moderado para 60 min intenso',
  (
    select format('%s pontos, pontuado %s', e.points, e.is_scored)
    from public.edit_workout(tests.recall('corrigivel')::uuid, 'corrida', 60, 'intenso', 8000) as e
  ),
  '20 pontos, pontuado t'
);
select tests.assert_equal(
  'o treino mudou mesmo, e a distância junto',
  (
    select format('%s min %s, %s m, %s pontos', w.duration_min, w.intensity, w.distance_m, w.points)
    from public.workouts as w
    where w.id = tests.recall('corrigivel')::uuid
  ),
  '60 min intenso, 8000 m, 20 pontos'
);

-- caso: semana fechada não muda
select tests.assert_raises(
  'treino de semana fechada',
  format($$select * from public.edit_workout('%s'::uuid, 'bike', 60, 'intenso')$$, tests.recall('antigo')),
  'week_closed'
);

-- caso: as regras de família valem na edição como valem no registro
select tests.assert_raises(
  'distância em musculação, na edição',
  format($$select * from public.edit_workout('%s'::uuid, 'musculacao', 60, 'intenso', 5000)$$, tests.recall('corrigivel')),
  'distance_not_allowed'
);
select tests.assert_raises(
  'duração fora da faixa',
  format($$select * from public.edit_workout('%s'::uuid, 'corrida', 0, 'intenso')$$, tests.recall('corrigivel')),
  'invalid_duration'
);
select tests.assert_equal(
  'nenhuma recusa gravou nada',
  (
    select format('%s min %s', w.duration_min, w.workout_type)
    from public.workouts as w
    where w.id = tests.recall('corrigivel')::uuid
  ),
  '60 min corrida'
);
select tests.clear_authentication();

-- caso: treino de outra pessoa não existe para quem pede
select tests.authenticate_as('cronista');
select tests.assert_raises(
  'editar treino alheio',
  format($$select * from public.edit_workout('%s'::uuid, 'corrida', 30, 'leve')$$, tests.recall('corrigivel')),
  'workout_not_found'
);
select tests.clear_authentication();
