-- Catálogo e privilégios: a superfície exposta pela Data API é exatamente a planejada.

-- caso: RLS ligado em todas as tabelas de public e private
select tests.assert_equal(
  'tabelas sem RLS',
  (
    select coalesce(string_agg(n.nspname || '.' || c.relname, ', ' order by n.nspname, c.relname), '')
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p') and not c.relrowsecurity
  ),
  ''
);

-- caso: anon não acessa nenhuma tabela, sequência ou função
select tests.assert_equal(
  'tabelas acessíveis a anon',
  (
    select coalesce(string_agg(n.nspname || '.' || c.relname, ', ' order by n.nspname, c.relname), '')
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (
        has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
      )
  ),
  ''
);
select tests.assert_equal(
  'sequências acessíveis a anon',
  (
    select coalesce(string_agg(n.nspname || '.' || c.relname, ', ' order by n.nspname, c.relname), '')
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      -- CASE garante a ordem: has_sequence_privilege só pode ver sequências.
      and case when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'USAGE, SELECT, UPDATE') else false end
  ),
  ''
);
select tests.assert_equal(
  'funções executáveis por anon',
  (
    select coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname), '')
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  ''
);

-- caso: authenticated só lê as tabelas previstas e não grava em nenhuma
select tests.assert_equal(
  'tabelas legíveis por authenticated',
  (
    select string_agg(n.nspname || '.' || c.relname, ', ' order by n.nspname, c.relname)
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and has_any_column_privilege('authenticated', c.oid, 'SELECT')
  ),
  'public.equipment, public.exercise_records, public.exercises, public.group_members, '
    || 'public.group_messages, public.groups, public.honor, public.honor_levels, public.message_reports, '
    || 'public.muscle_groups, public.profiles, public.rank_tiers, '
    || 'public.routine_exercises, public.routines, public.weekly_goals, public.workout_sets, '
    || 'public.workout_types, public.workouts'
);
select tests.assert_equal(
  'tabelas graváveis por authenticated',
  (
    select coalesce(string_agg(n.nspname || '.' || c.relname, ', ' order by n.nspname, c.relname), '')
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (
        has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege('authenticated', c.oid, 'INSERT, UPDATE, REFERENCES')
      )
  ),
  ''
);
select tests.assert_equal(
  'sequências acessíveis a authenticated',
  (
    select coalesce(string_agg(n.nspname || '.' || c.relname, ', ' order by n.nspname, c.relname), '')
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and case when c.relkind = 'S' then has_sequence_privilege('authenticated', c.oid, 'USAGE, SELECT, UPDATE') else false end
  ),
  ''
);

-- caso: authenticated executa só as RPCs do app e as funções de membresia do RLS
select tests.assert_equal(
  'funções executáveis por authenticated',
  (
    select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'private.avatar_owner, private.can_see_avatar, private.can_write_avatar, '
    || 'private.is_group_member, private.shares_group_with, public.claim_route_request, public.clear_message_reports, public.complete_profile, '
    || 'public.create_exercise, public.create_group, public.delete_message, public.delete_routine, '
    || 'public.edit_workout, public.get_group_invite, public.group_mural, public.group_season_table, '
    || 'public.group_weekly_ranking, '
    || 'public.join_group_by_code, public.leave_group, public.legion_photos, public.log_strength_workout, public.log_workout, '
    || 'public.my_groups, public.my_honor, public.my_profile, public.my_progress, public.my_records, public.my_weekly_goal, '
    || 'public.my_workout_months, public.my_workouts, public.post_message, public.preview_invite, '
    || 'public.profile_trophies, '
    || 'public.regenerate_invite, public.report_message, public.save_routine, public.set_avatar, public.set_data_consent, '
    || 'public.set_health_consent, '
    || 'public.set_weekly_goal, public.settle_group_seasons, public.update_group'
);

-- caso: esquema private fechado para os papéis da API
select tests.assert_equal('anon usa o esquema private', has_schema_privilege('anon', 'private', 'USAGE'), false);
select tests.assert_equal(
  'authenticated usa o esquema private',
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  false
);

-- caso: security definer só nas RPCs, nas funções de membresia e no gatilho de saída
select tests.assert_equal(
  'funções security definer',
  (
    select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
  ),
  'private.can_see_avatar, private.can_write_avatar, '
    || 'private.is_group_member, private.on_group_member_removed, private.shares_group_with, '
    || 'public.claim_route_request, public.clear_message_reports, public.complete_profile, public.create_exercise, public.create_group, '
    || 'public.delete_message, public.delete_routine, public.edit_workout, public.get_group_invite, '
    || 'public.group_mural, public.group_season_table, public.group_weekly_ranking, '
    || 'public.join_group_by_code, public.leave_group, public.legion_photos, '
    || 'public.log_strength_workout, public.log_workout, public.my_groups, public.my_honor, public.my_profile, '
    || 'public.my_progress, public.my_records, public.my_weekly_goal, public.my_workout_months, '
    || 'public.my_workouts, public.post_message, public.preview_invite, public.profile_trophies, '
    || 'public.regenerate_invite, '
    || 'public.report_message, public.save_routine, public.set_avatar, public.set_data_consent, '
    || 'public.set_health_consent, public.set_weekly_goal, '
    || 'public.settle_group_seasons, public.update_group'
);

-- caso: toda função de public e private fixa search_path vazio
select tests.assert_equal(
  'funções com search_path mutável',
  (
    select coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname), '')
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not coalesce(p.proconfig @> array['search_path=""'], false)
  ),
  ''
);

-- caso: tabelas e funções pertencem ao postgres
select tests.assert_equal(
  'objetos com outro dono',
  (
    select coalesce(string_agg(object_name, ', ' order by object_name), '')
    from (
      select n.nspname || '.' || p.proname as object_name
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and pg_get_userbyid(p.proowner) <> 'postgres'
      union all
      select n.nspname || '.' || c.relname
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
      where n.nspname in ('public', 'private')
        and c.relkind in ('r', 'p', 'S', 'v', 'm')
        and pg_get_userbyid(c.relowner) <> 'postgres'
    ) as owned
  ),
  ''
);

-- caso: escada de ranks começa em 0 e sobe sem repetir
select tests.assert_equal('divisões', (select count(*)::integer from public.rank_tiers), 19);
select tests.assert_equal('primeira divisão', (select min_glory from public.rank_tiers where id = 1), 0);
select tests.assert_true(
  'Glória mínima cresce a cada divisão',
  not exists (
    select 1
    from public.rank_tiers as lower_tier
    join public.rank_tiers as upper_tier on upper_tier.id = lower_tier.id + 1
    where upper_tier.min_glory <= lower_tier.min_glory
  )
  and (select max(id) from public.rank_tiers) = 19
);
