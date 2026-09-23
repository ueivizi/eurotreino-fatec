-- Juramento da semana: meta pessoal, sequência de dias e Chama de Vesta.
--
-- A regra que mais importa aqui é a mesma da Honra: **o juramento não encosta na Glória nem no
-- Coliseu**. Ele é o placar de quem treina sozinho.
--
-- Os treinos são ancorados na semana corrente (segunda + N dias), e não em "agora menos N dias":
-- assim o teste vale igual numa segunda-feira e num domingo. O `p_now` do registro é o mesmo
-- instante do treino, então nem a janela de 48 h nem a recusa de treino no futuro atrapalham.

create function tests.meta_log(p_user text, p_at timestamptz, p_type text default 'corrida', p_duration integer default 30)
returns uuid
language sql
as $$
  select (
    private.log_workout_for(
      tests.user_id(p_user), p_at, gen_random_uuid(), p_type, p_duration, 'moderado', p_at
    )
  ).workout_id;
$$;

select tests.create_member('jurador', 'Jurador', 'coruja');
select tests.create_member('sequencia', 'Sequência', 'raio');
select tests.create_member('vestal', 'Vestal', 'elmo');

-- ---------------------------------------------------------------------------------------------
-- Meta da semana (RF015, RF016)

-- Três dias da semana corrente: segunda, terça e quarta.
select tests.meta_log('jurador', private.week_start(now()) + interval '12 hours');
select tests.meta_log('jurador', private.week_start(now()) + interval '1 day 12 hours');
select tests.meta_log('jurador', private.week_start(now()) + interval '1 day 19 hours');
select tests.meta_log('jurador', private.week_start(now()) + interval '2 days 12 hours');

select tests.authenticate_as('jurador');

-- caso: sem juramento não há meta em vigor, e a Chama não acende
select tests.assert_equal(
  'semana sem juramento',
  (
    select format('meta %s, %s dias, cumprida %s, chama %s', coalesce(g.target::text, 'nenhuma'), g.days_done, g.goal_met, g.weeks_in_a_row)
    from public.my_weekly_goal() as g
  ),
  'meta nenhuma, 3 dias, cumprida f, chama 0'
);

-- caso: a meta conta dias, não registros -- a terça com dois treinos vale por uma terça
select tests.assert_equal(
  'dias da semana, de segunda a domingo',
  (select format('%s', g.days_trained) from public.my_weekly_goal() as g),
  '{t,t,t,f,f,f,f}'
);

-- caso: jurar 3 dias fecha o juramento da semana corrente
select tests.assert_equal(
  'juramento cumprido',
  (
    select format('meta %s, %s dias, cumprida %s, chama %s', g.target, g.days_done, g.goal_met, g.weeks_in_a_row)
    from public.set_weekly_goal(3) as g
  ),
  'meta 3, 3 dias, cumprida t, chama 1'
);

-- caso: mudar a meta no meio da semana recalcula a semana corrente com a meta nova (RF015)
select tests.assert_equal(
  'jurar 5 no meio da semana',
  (select format('meta %s, cumprida %s', g.target, g.goal_met) from public.set_weekly_goal(5) as g),
  'meta 5, cumprida f'
);
select tests.assert_equal(
  'o juramento da semana é um só, não um por vez que se jura',
  (select count(*)::integer from public.weekly_goals),
  1
);

-- caso: zero é "sem juramento" -- quem quer parar de se cobrar não precisa apagar nada
select tests.assert_equal(
  'jurar zero',
  (select format('meta %s, cumprida %s, chama %s', coalesce(g.target::text, 'nenhuma'), g.goal_met, g.weeks_in_a_row) from public.set_weekly_goal(0) as g),
  'meta nenhuma, cumprida f, chama 0'
);

-- caso: fora da faixa de 0 a 7 não existe
select tests.assert_raises('meta de 8 dias', $$select * from public.set_weekly_goal(8)$$, 'invalid_goal');
select tests.assert_raises('meta negativa', $$select * from public.set_weekly_goal(-1)$$, 'invalid_goal');

-- caso: jurar não mexe na Glória nem na semana do Coliseu
select tests.remember('gloria_antes', (select p.week_glory::text from public.my_progress() as p));
select public.set_weekly_goal(4);
select tests.assert_equal(
  'a Glória da semana é a mesma depois do juramento',
  (select p.week_glory::integer from public.my_progress() as p),
  tests.recall('gloria_antes')::integer
);
select tests.assert_equal(
  'e nenhum treino foi remarcado',
  (select count(*)::integer from public.workouts as w where w.user_id = tests.user_id('jurador') and w.is_scored),
  4
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- Sequência de dias (RF017)

-- Ontem e anteontem, com um buraco antes: a sequência viva vale 2.
select tests.meta_log('sequencia', now() - interval '1 day');
select tests.meta_log('sequencia', now() - interval '2 days');
select tests.meta_log('sequencia', now() - interval '4 days');

select tests.authenticate_as('sequencia');

-- caso: quem treinou ontem e ainda não treinou hoje continua com a sequência viva
select tests.assert_equal(
  'sequência ancorada em ontem',
  (select g.streak_days from public.my_weekly_goal() as g),
  2
);
select tests.clear_authentication();

-- caso: treinar hoje estende a sequência; o buraco de três dias atrás não volta
select tests.meta_log('sequencia', now());
select tests.authenticate_as('sequencia');
select tests.assert_equal(
  'sequência de hoje, ontem e anteontem',
  (select g.streak_days from public.my_weekly_goal() as g),
  3
);
select tests.clear_authentication();

-- caso: quem parou há mais de um dia começa do zero
select tests.authenticate_as('vestal');
select tests.assert_equal('sem treino, sem sequência', (select g.streak_days from public.my_weekly_goal() as g), 0);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- Chama de Vesta: semanas seguidas cumprindo o juramento

-- Juramento de 2 dias desde três semanas atrás, cumprido nas duas últimas semanas fechadas.
insert into public.weekly_goals (user_id, week_start, target)
values (tests.user_id('vestal'), private.week_start(now()) - 21, 2);

select tests.meta_log('vestal', private.week_start(now()) - 14 + interval '12 hours');
select tests.meta_log('vestal', private.week_start(now()) - 14 + interval '2 days 12 hours');
select tests.meta_log('vestal', private.week_start(now()) - 7 + interval '12 hours');
select tests.meta_log('vestal', private.week_start(now()) - 7 + interval '3 days 12 hours');

select tests.authenticate_as('vestal');

-- caso: a semana corrente ainda vazia não apaga a Chama das semanas fechadas
select tests.assert_equal(
  'duas semanas seguidas',
  (select format('meta %s, %s dias nesta semana, chama %s', g.target, g.days_done, g.weeks_in_a_row) from public.my_weekly_goal() as g),
  'meta 2, 0 dias nesta semana, chama 2'
);
select tests.clear_authentication();

-- caso: cumprir a semana corrente soma mais uma
select tests.meta_log('vestal', private.week_start(now()) + interval '12 hours');
select tests.meta_log('vestal', private.week_start(now()) + interval '1 day 12 hours');
select tests.authenticate_as('vestal');
select tests.assert_equal(
  'três semanas seguidas',
  (select g.weeks_in_a_row from public.my_weekly_goal() as g),
  3
);
select tests.clear_authentication();

-- caso: semana sem juramento em vigor não alimenta a Chama
select tests.create_member('sem_juramento', 'Sem Juramento', 'aguia');
select tests.meta_log('sem_juramento', private.week_start(now()) - 7 + interval '12 hours');
select tests.meta_log('sem_juramento', private.week_start(now()) - 7 + interval '1 day 12 hours');
select tests.authenticate_as('sem_juramento');
select tests.assert_equal(
  'treinou, mas não tinha prometido nada',
  (select g.weeks_in_a_row from public.my_weekly_goal() as g),
  0
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- Quem vê o quê

-- caso: o juramento é de quem jurou, e de mais ninguém
select tests.authenticate_as('jurador');
select tests.assert_equal(
  'a tabela só mostra as próprias linhas',
  (select count(*)::integer from public.weekly_goals as g where g.user_id <> tests.user_id('jurador')),
  0
);
select tests.assert_equal(
  'o retrato é o meu, não o do vizinho',
  (
    select format('meta %s, chama %s', g.target, g.weeks_in_a_row)
    from public.my_weekly_goal() as g
  ),
  -- A Chama da Vestal (3) não atravessa: aqui a meta é 4, com 3 dias, e a semana passada nem teve juramento.
  'meta 4, chama 0'
);
select tests.clear_authentication();

select tests.authenticate_as_anon();
select tests.assert_raises('anon não lê juramento', $$select * from public.my_weekly_goal()$$, 'permission denied for function my_weekly_goal');
select tests.assert_raises('anon não jura', $$select * from public.set_weekly_goal(3)$$, 'permission denied for function set_weekly_goal');
select tests.assert_raises('anon não lê a tabela', $$select count(*) from public.weekly_goals$$, 'permission denied for table weekly_goals');
select tests.clear_authentication();
