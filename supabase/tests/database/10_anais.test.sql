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
