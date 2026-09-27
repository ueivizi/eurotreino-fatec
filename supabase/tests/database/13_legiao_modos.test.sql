-- Modos de Legião: clássica e competitiva, temporadas com Louros e Triunfos.
--
-- A temporada de teste começa 4 semanas antes da corrente, então a primeira temporada inteira já
-- fechou e a segunda está na semana 1. Cada treino é corrida de 30 min moderada: 10 + 3 + 2 = 15
-- de Glória, e o 3º pontuado da semana leva +10 de constância. Mínimo da Legião: 2 treinos.
--
-- Contas feitas à mão (semanas S0 a S3 da temporada 1):
--   Aurélia: 2 treinos em cada semana. S0 2º (+10 +10), S1 1º (+25), S2 e S3 empatada em 1º (+25)
--            = 95 Louros, cumpriu as 4 semanas: Triunfo de ouro e Invicto.
--   Brutus:  S0 3 treinos, 1º (+25); S1 nenhum (-15); S2 e S3 empatado em 1º (+25) = 60: prata.
--   Cássio:  nunca treinou: -15 toda semana, mas os Louros param no zero.
--   Druso:   entrou no meio da S2 (não conta); na S3 um treino só: -15 do mínimo, +5 do 3º lugar,
--            e para no zero.

create function tests.modo_log(p_user text, p_at timestamptz)
returns void
language plpgsql
as $$
begin
  perform private.log_workout_for(tests.user_id(p_user), p_at, gen_random_uuid(), 'corrida', 30, 'moderado', p_at);
end;
$$;

select tests.create_member('aurelia', 'Aurélia', 'aguia');
select tests.create_member('brutus', 'Brutus', 'leao');
select tests.create_member('cassio', 'Cássio', 'loba');
select tests.create_member('druso', 'Druso', 'raio');
select tests.create_member('estranho', 'Estranho', 'elmo');
select tests.create_member('vizinho', 'Vizinho', 'coruja');

select tests.create_legion('arena', 'Legião Arena', array['aurelia', 'brutus', 'cassio', 'druso']);
select tests.create_legion('outra', 'Legião Outra', array['vizinho', 'aurelia']);

select tests.remember('inicio', (private.week_start(now()) - 28)::text);
select tests.remember('proxima', (private.week_start(now()) + 7)::text);

update public.groups
set mode = 'competitiva', weekly_minimum = 2, mode_since = tests.recall('inicio')::date
where id = tests.recall('arena')::uuid;

-- Todos já estavam na Legião antes da temporada; Druso entra na terça da S2.
update public.group_members
set joined_at = (tests.recall('inicio')::date - 7)::timestamp at time zone 'America/Sao_Paulo'
where group_id = tests.recall('arena')::uuid;
update public.group_members
set joined_at = (tests.recall('inicio')::date + 15)::timestamp at time zone 'America/Sao_Paulo'
where group_id = tests.recall('arena')::uuid and user_id = tests.user_id('druso');

-- S0 a S3: Aurélia treina segunda e terça de toda semana.
select tests.modo_log('aurelia', ((tests.recall('inicio')::date + 7 * s + d)::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo')
from generate_series(0, 3) as s, generate_series(0, 1) as d;
-- Brutus: três na S0, nenhum na S1, dois na S2 e dois na S3.
select tests.modo_log('brutus', ((tests.recall('inicio')::date + d)::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo')
from generate_series(0, 2) as d;
select tests.modo_log('brutus', ((tests.recall('inicio')::date + 7 * s + d)::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo')
from generate_series(2, 3) as s, generate_series(0, 1) as d;
-- Druso: um treino na S3.
select tests.modo_log('druso', ((tests.recall('inicio')::date + 21)::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo');

-- ---------------------------------------------------------------------------------------------
-- Fundar e mudar o modo

select tests.authenticate_as('estranho');

-- caso: a competitiva exige mínimo de 2 a 4; a clássica não aceita mínimo
select tests.assert_raises('competitiva sem mínimo', $$select * from public.create_group('Legião Dura', 'leao', 'porfiro', 'competitiva')$$, 'invalid_weekly_minimum');
select tests.assert_raises('mínimo 5', $$select * from public.create_group('Legião Dura', 'leao', 'porfiro', 'competitiva', 5)$$, 'invalid_weekly_minimum');
select tests.assert_raises('clássica com mínimo', $$select * from public.create_group('Legião Leve', 'leao', 'porfiro', 'classica', 3)$$, 'invalid_weekly_minimum');
select tests.assert_raises('modo inventado', $$select * from public.create_group('Legião Leve', 'leao', 'porfiro', 'hardcore')$$, 'invalid_group_mode');
select tests.assert_raises('cor fora da lista', $$select * from public.create_group('Legião Leve', 'leao', 'rosa')$$, 'invalid_emblem_color');

-- caso: fundar sem escolher continua clássica, com o estandarte de pórfiro
select tests.assert_equal(
  'padrão de antes',
  (select format('%s %s %s %s', c.mode, c.banner_color, coalesce(c.weekly_minimum::text, '-'), coalesce(c.mode_since::text, '-')) from public.create_group('Legião Leve', 'coruja') as c),
  'classica porfiro - -'
);

-- caso: a competitiva começa na segunda seguinte, com o estandarte escolhido
select tests.assert_equal(
  'temporada começa na próxima segunda',
  (
    select format('%s %s %s %s', c.mode, c.banner_color, c.weekly_minimum, c.mode_since = tests.recall('proxima')::date)
    from public.create_group('Legião Dura', 'leao', 'oliva', 'competitiva', 3) as c
  ),
  'competitiva oliva 3 t'
);

-- caso: só o fundador muda o estandarte e o modo
select tests.authenticate_as('brutus');
select tests.assert_raises(
  'membro comum',
  format($$select * from public.update_group(%L, 'leao', 'ouro', 'competitiva', 2)$$, tests.recall('arena')),
  'not_group_owner'
);

-- caso: o mínimo fica travado enquanto a Legião é competitiva
select tests.authenticate_as('aurelia');
select tests.assert_raises(
  'trocar o mínimo no meio da temporada',
  format($$select * from public.update_group(%L, 'aguia', 'ouro', 'competitiva', 3)$$, tests.recall('arena')),
  'minimum_locked'
);
select tests.assert_equal(
  'trocar só o estandarte mantém a temporada',
  (
    select format('%s %s %s', u.banner_color, u.weekly_minimum, u.mode_since = tests.recall('inicio')::date)
    from public.update_group(tests.recall('arena')::uuid, 'aguia', 'ouro', 'competitiva', 2) as u
  ),
  'ouro 2 t'
);

-- caso: virar competitiva começa a contagem na segunda seguinte, e voltar a ser clássica zera tudo
select tests.authenticate_as('vizinho');
select tests.assert_equal(
  'clássica vira competitiva',
  (
    select format('%s %s', u.mode, u.mode_since = tests.recall('proxima')::date)
    from public.update_group(tests.recall('outra')::uuid, 'coruja', 'porfiro', 'competitiva', 4) as u
  ),
  'competitiva t'
);
select tests.assert_equal(
  'competitiva volta a ser clássica',
  (
    select format('%s %s', u.mode, coalesce(u.mode_since::text, '-'))
    from public.update_group(tests.recall('outra')::uuid, 'coruja', 'porfiro', 'classica') as u
  ),
  'classica -'
);

-- ---------------------------------------------------------------------------------------------
-- Tabela da temporada

-- caso: quem não é membro não vê a tabela, e Legião clássica não tem tabela
select tests.authenticate_as('estranho');
select tests.assert_raises('estranho', format($$select * from public.group_season_table(%L)$$, tests.recall('arena')), 'not_a_member');
select tests.authenticate_as('vizinho');
select tests.assert_raises('clássica', format($$select * from public.group_season_table(%L)$$, tests.recall('outra')), 'not_competitive');
select tests.authenticate_as('aurelia');
select tests.assert_raises('temporada inventada', format($$select * from public.group_season_table(%L, -2)$$, tests.recall('arena')), 'invalid_season_offset');

-- caso: a temporada fechada tem os Louros das contas acima, com o piso no zero
select tests.assert_equal(
  'tabela da temporada 1',
  (
    select string_agg(format('%s:%s:%s', t.place, t.display_name, t.louros), ' ' order by t.place, t.display_name)
    from public.group_season_table(tests.recall('arena')::uuid, -1) as t
  ),
  '1:Aurélia:95 2:Brutus:60 3:Druso:0 4:Cássio:0'
);

-- caso: semanas cumpridas, pódios, Glória da temporada e a última semana
select tests.assert_equal(
  'detalhes de cada um',
  (
    select string_agg(
      format('%s c%s m%s p%s g%s d%s', t.display_name, t.weeks_counted, t.weeks_met, t.podiums, t.season_glory, t.last_delta),
      ' | ' order by t.display_name
    )
    from public.group_season_table(tests.recall('arena')::uuid, -1) as t
  ),
  'Aurélia c4 m4 p4 g120 d25 | Brutus c4 m3 p3 g115 d25 | Cássio c4 m0 p0 g0 d-15 | Druso c1 m0 p1 g15 d-10'
);

-- caso: a temporada corrente está na semana 1, ainda sem semana fechada
select tests.clear_authentication();
select tests.modo_log('aurelia', now() - interval '1 minute');
select tests.authenticate_as('aurelia');
select tests.assert_equal(
  'temporada corrente',
  (
    select string_agg(format('%s:%s:%s', t.display_name, t.louros, t.week_scored), ' ' order by t.display_name)
      || format(' semana %s de mínimo %s', min(t.season_week), min(t.weekly_minimum))
    from public.group_season_table(tests.recall('arena')::uuid) as t
  ),
  'Aurélia:0:1 Brutus:0:0 Cássio:0:0 Druso:0:0 semana 1 de mínimo 2'
);

-- caso: Louros não mexem na Glória, que continua a soma dos treinos
select tests.assert_equal(
  'Glória do Cássio e do Druso',
  (
    select string_agg(format('%s:%s', r.display_name, r.total_glory), ' ' order by r.display_name)
    from public.group_weekly_ranking(tests.recall('arena')::uuid) as r
    where r.display_name in ('Cássio', 'Druso')
  ),
  'Cássio:0 Druso:15'
);

-- ---------------------------------------------------------------------------------------------
-- Triunfos

-- caso: a apuração entrega os Triunfos da temporada encerrada a quem chamou
select tests.assert_equal(
  'Triunfos da Aurélia',
  (
    select string_agg(format('%s:%s', s.kind, s.louros), ' ' order by s.kind)
    from public.settle_group_seasons(tests.recall('arena')::uuid) as s
  ),
  'invicto:95 triunfo_ouro:95'
);

-- caso: apurar de novo não duplica nada
select tests.assert_equal('segunda apuração', (select count(*)::integer from public.settle_group_seasons(tests.recall('arena')::uuid)), 0);
select tests.clear_authentication();
select tests.assert_equal(
  'todos os Triunfos da Legião',
  (select string_agg(format('%s:%s', p.display_name, t.kind), ' ' order by p.display_name, t.kind) from public.trophies as t join public.profiles as p on p.id = t.user_id),
  'Aurélia:invicto Aurélia:triunfo_ouro Brutus:triunfo_prata'
);

-- caso: quem tem zero Louros não ganha bronze, nem por estar em 3º
select tests.clear_authentication();
select tests.assert_equal(
  'sem bronze',
  (select count(*)::integer from public.trophies as t where t.kind = 'triunfo_bronze'),
  0
);

-- caso: o perfil mostra os Triunfos para quem divide a Legião, com o nome dela
select tests.authenticate_as('brutus');
select tests.assert_equal(
  'Brutus vê os da Aurélia',
  (
    select string_agg(format('%s@%s', t.kind, t.group_name), ' ' order by t.kind)
    from public.profile_trophies(tests.user_id('aurelia')) as t
  ),
  'invicto@Legião Arena triunfo_ouro@Legião Arena'
);

-- caso: quem divide outra Legião vê o Triunfo, mas não o nome da Legião onde ele saiu
select tests.authenticate_as('vizinho');
select tests.assert_equal(
  'Vizinho vê sem o nome',
  (
    select string_agg(format('%s@%s', t.kind, coalesce(t.group_name, '?')), ' ' order by t.kind)
    from public.profile_trophies(tests.user_id('aurelia')) as t
  ),
  'invicto@? triunfo_ouro@?'
);

-- caso: quem não divide Legião nenhuma não vê nada
select tests.authenticate_as('estranho');
select tests.assert_raises(
  'estranho',
  format($$select * from public.profile_trophies(%L)$$, tests.user_id('aurelia')),
  'member_not_found'
);

-- caso: os Triunfos ficam com a pessoa depois que a Legião acaba
select tests.clear_authentication();
delete from public.groups where id = tests.recall('arena')::uuid;
select tests.authenticate_as('aurelia');
select tests.assert_equal(
  'Triunfos sem a Legião',
  (select string_agg(format('%s@%s', t.kind, t.group_name), ' ' order by t.kind) from public.profile_trophies() as t),
  'invicto@Legião Arena triunfo_ouro@Legião Arena'
);
