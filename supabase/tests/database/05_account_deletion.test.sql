-- RF011 excluir conta e dados pessoais. A exclusão acontece no Supabase Auth (auth.users);
-- o banco precisa levar junto perfil, treinos, vínculos e tentativas, sem quebrar as Legiões.

select tests.create_member('ana', 'Ana', 'aguia');
select tests.create_member('bruno', 'Bruno', 'leao');
select tests.create_member('carla', 'Carla', 'coruja');
select tests.create_legion('fenix', 'Legião Fênix', array['ana', 'bruno', 'carla']);
select tests.create_legion('solo', 'Legião Solo', array['ana']);

select private.log_workout_for(tests.user_id('ana'), now(), gen_random_uuid(), 'corrida', 30, 'leve', null);
select private.log_workout_for(tests.user_id('bruno'), now(), gen_random_uuid(), 'corrida', 30, 'leve', null);

select tests.authenticate_as('ana');
select * from public.get_group_invite(tests.recall('fenix')::uuid);
select * from public.join_group_by_code('ZZZZZZZZ');
select tests.clear_authentication();

-- caso: excluir a conta apaga os dados pessoais e passa a Legião adiante
delete from auth.users where id = tests.user_id('ana');

select tests.assert_equal(
  'perfil, treinos, vínculos e tentativas da Ana',
  (
    select format(
      'perfis %s, treinos %s, vínculos %s, tentativas %s',
      (select count(*) from public.profiles where id = tests.user_id('ana')),
      (select count(*) from public.workouts where user_id = tests.user_id('ana')),
      (select count(*) from public.group_members where user_id = tests.user_id('ana')),
      (select count(*) from private.join_attempts where user_id = tests.user_id('ana'))
    )
  ),
  'perfis 0, treinos 0, vínculos 0, tentativas 0'
);
select tests.assert_equal(
  'Bruno, o mais antigo, virou fundador da Fênix',
  (
    select string_agg(p.display_name || ':' || gm.role, ', ' order by gm.joined_at)
    from public.group_members as gm
    join public.profiles as p on p.id = gm.user_id
    where gm.group_id = tests.recall('fenix')::uuid
  ),
  'Bruno:owner, Carla:member'
);
select tests.assert_equal(
  'Legião em que a Ana estava sozinha foi apagada',
  (select count(*)::integer from public.groups where id = tests.recall('solo')::uuid),
  0
);
select tests.assert_equal(
  'convites e auditoria ficam sem apontar para a Ana',
  (
    select format(
      'convites com autora %s, eventos com autora %s',
      (select count(*) from private.group_invites where created_by = tests.user_id('ana')),
      (select count(*) from private.audit_log where actor_id = tests.user_id('ana'))
    )
  ),
  'convites com autora 0, eventos com autora 0'
);
select tests.assert_equal(
  'treinos dos outros continuam',
  (select count(*)::integer from public.workouts where user_id = tests.user_id('bruno')),
  1
);

-- caso: quem continua na Legião deixa de ver a conta excluída
select tests.authenticate_as('carla');
select tests.assert_equal(
  'Arena da Fênix',
  (
    select string_agg(r.display_name, ', ' order by r.display_name)
    from public.group_weekly_ranking(tests.recall('fenix')::uuid) as r
  ),
  'Bruno, Carla'
);
select tests.clear_authentication();
