-- RF003 fundar Legião · RF004 convidar · RF005 entrar por código · NF014 limite de tentativas.

select tests.create_user('sem_perfil');
select tests.create_member('ana', 'Ana', 'aguia');
select tests.create_member('bruno', 'Bruno', 'leao');
select tests.create_member('carla', 'Carla', 'coruja');
select tests.create_member('diego', 'Diego', 'raio');
select tests.create_member('forca', 'Força Bruta', 'elmo');
select tests.create_member('colecionador', 'Colecionador', 'pegaso');

-- caso: sem perfil não se funda Legião
select tests.authenticate_as('sem_perfil');
select tests.assert_raises(
  'usuário sem perfil',
  $$select * from public.create_group('Legião Fênix', 'aguia')$$,
  'profile_required'
);
select tests.clear_authentication();

-- caso: nome e emblema da Legião são validados
select tests.authenticate_as('ana');
select tests.assert_raises('2 caracteres', $$select * from public.create_group('AB', 'aguia')$$, 'invalid_group_name');
select tests.assert_raises(
  '41 caracteres',
  $$select * from public.create_group(repeat('L', 41), 'aguia')$$,
  'invalid_group_name'
);
select tests.assert_raises(
  'texto gigante',
  $$select * from public.create_group(repeat('L', 100000), 'aguia')$$,
  'invalid_group_name'
);
select tests.assert_raises(
  'marcação HTML',
  $$select * from public.create_group('<script>alert(1)</script>', 'aguia')$$,
  'invalid_group_name'
);
select tests.assert_raises(
  'emblema inventado',
  $$select * from public.create_group('Legião Fênix', 'fenix')$$,
  'invalid_emblem'
);
select tests.clear_authentication();

-- caso: fundar Legião cria o fundador e o primeiro convite
select tests.authenticate_as('ana');
select
  tests.remember('fenix', created.group_id::text),
  tests.remember('fenix_code', created.invite_code)
from public.create_group('Legião Fênix', 'aguia') as created;
select tests.clear_authentication();

select tests.assert_equal(
  'fundador',
  (
    select string_agg(p.display_name || ':' || gm.role, ', ')
    from public.group_members as gm
    join public.profiles as p on p.id = gm.user_id
    where gm.group_id = tests.recall('fenix')::uuid
  ),
  'Ana:owner'
);
select tests.assert_true(
  'código no formato de 8 caracteres sem 0, 1, I e O',
  tests.recall('fenix_code') ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'
);
select tests.assert_equal(
  'validade de 7 dias',
  (select expires_at - created_at from private.group_invites where code = tests.recall('fenix_code')),
  interval '7 days'
);
select tests.assert_equal(
  'eventos auditados',
  (
    select string_agg(action, ', ' order by id)
    from private.audit_log
    where group_id = tests.recall('fenix')::uuid
  ),
  'group.created, invite.issued'
);

-- caso: prévia mostra só nome, emblema e tamanho, aceitando o código digitado de vários jeitos
select tests.authenticate_as('bruno');
select tests.assert_equal(
  'prévia em minúsculas e com hífen',
  (
    select format('%s|%s|%s|%s|%s', status, group_name, group_emblem, member_count, is_member)
    from public.preview_invite(
      lower(substr(tests.recall('fenix_code'), 1, 4) || '-' || substr(tests.recall('fenix_code'), 5))
    )
  ),
  'ok|Legião Fênix|aguia|1|f'
);
select tests.clear_authentication();

-- caso: entrar por código, e entrar de novo não duplica
select tests.authenticate_as('bruno');
select tests.assert_equal(
  'entrada',
  (select status || '|' || group_name from public.join_group_by_code(tests.recall('fenix_code'))),
  'joined|Legião Fênix'
);
select tests.assert_equal(
  'segunda entrada',
  (select status from public.join_group_by_code(tests.recall('fenix_code'))),
  'already_member'
);
select tests.assert_equal(
  'prévia de quem já é membro',
  (select is_member from public.preview_invite(tests.recall('fenix_code'))),
  true
);
select tests.clear_authentication();
select tests.assert_equal(
  'membros',
  (select count(*)::integer from public.group_members where group_id = tests.recall('fenix')::uuid),
  2
);

-- caso: qualquer membro vê o convite aberto; quem está fora recebe o mesmo erro de Legião inexistente
select tests.authenticate_as('bruno');
select tests.assert_equal(
  'Bruno vê o mesmo código',
  (select code from public.get_group_invite(tests.recall('fenix')::uuid)),
  tests.recall('fenix_code')
);
select tests.clear_authentication();
select tests.authenticate_as('diego');
select tests.assert_raises(
  'Diego, de fora',
  format('select * from public.get_group_invite(%L)', tests.recall('fenix')),
  'not_a_member'
);
select tests.assert_raises(
  'Legião inexistente',
  format('select * from public.get_group_invite(%L)', gen_random_uuid()),
  'not_a_member'
);
select tests.clear_authentication();

-- caso: código inválido não revela nada e conta como tentativa inválida
select tests.authenticate_as('diego');
select tests.assert_equal(
  'prévia de código inexistente',
  (select format('%s|%s|%s|%s|%s', status, group_name, group_emblem, member_count, is_member) from public.preview_invite('ZZZZ-ZZZZ')),
  'invalid||||'
);
select tests.assert_equal(
  'entrada com código malformado',
  (select format('%s|%s|%s', status, group_id, group_name) from public.join_group_by_code('<script>')),
  'invalid||'
);
select tests.assert_equal(
  'entrada com código gigante',
  (select status from public.join_group_by_code(repeat('A', 10000))),
  'invalid'
);
select tests.clear_authentication();
select tests.assert_equal(
  'tentativas inválidas gravadas',
  (select count(*)::integer from private.join_attempts where user_id = tests.user_id('diego')),
  3
);

-- caso: 10 tentativas inválidas em 1 hora bloqueiam até o código certo
select tests.authenticate_as('forca');
select tests.assert_equal(
  '10 tentativas inválidas',
  (
    select count(*)::integer
    from generate_series(1, 10) as attempt
    cross join lateral public.join_group_by_code('ZZZZZZZ' || (array['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'])[attempt]) as tried
    where tried.status = 'invalid'
  ),
  10
);
select tests.assert_equal(
  '11ª tentativa, com o código certo',
  (select status from public.join_group_by_code(tests.recall('fenix_code'))),
  'rate_limited'
);
select tests.assert_equal(
  'prévia também bloqueada',
  (select status from public.preview_invite(tests.recall('fenix_code'))),
  'rate_limited'
);
select tests.clear_authentication();
select tests.assert_equal(
  'bloqueio auditado uma única vez',
  (select count(*)::integer from private.audit_log where actor_id = tests.user_id('forca') and action = 'invite.rate_limited'),
  1
);
select tests.assert_equal(
  'tentativas bloqueadas não são gravadas',
  (select count(*)::integer from private.join_attempts where user_id = tests.user_id('forca')),
  10
);

-- caso: passada 1 hora, o bloqueio acaba
update private.join_attempts
set attempted_at = attempted_at - interval '61 minutes'
where user_id = tests.user_id('forca');
select tests.authenticate_as('forca');
select tests.assert_equal(
  'entrada depois da janela',
  (select status from public.join_group_by_code(tests.recall('fenix_code'))),
  'joined'
);
select tests.clear_authentication();

-- caso: só o fundador gera novo código, e o anterior deixa de valer
select tests.authenticate_as('bruno');
select tests.assert_raises(
  'membro comum',
  format('select * from public.regenerate_invite(%L)', tests.recall('fenix')),
  'not_group_owner'
);
select tests.clear_authentication();
select tests.authenticate_as('diego');
select tests.assert_raises(
  'quem está fora',
  format('select * from public.regenerate_invite(%L)', tests.recall('fenix')),
  'not_group_owner'
);
select tests.clear_authentication();
select tests.authenticate_as('ana');
select tests.remember('fenix_new_code', (select code from public.regenerate_invite(tests.recall('fenix')::uuid)));
select tests.clear_authentication();
select tests.assert_true('código novo é diferente', tests.recall('fenix_new_code') <> tests.recall('fenix_code'));
select tests.authenticate_as('carla');
select tests.assert_equal(
  'código antigo',
  (select status from public.preview_invite(tests.recall('fenix_code'))),
  'invalid'
);
select tests.assert_equal(
  'código novo',
  (select status from public.preview_invite(tests.recall('fenix_new_code'))),
  'ok'
);
select tests.clear_authentication();

-- caso: convite vencido deixa de valer e um novo é emitido para o membro
update private.group_invites
set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
where code = tests.recall('fenix_new_code');
select tests.authenticate_as('carla');
select tests.assert_equal(
  'prévia de código vencido',
  (select status from public.preview_invite(tests.recall('fenix_new_code'))),
  'invalid'
);
select tests.clear_authentication();
select tests.authenticate_as('bruno');
select tests.remember('fenix_renewed_code', (select code from public.get_group_invite(tests.recall('fenix')::uuid)));
select tests.clear_authentication();
select tests.assert_true('código renovado é outro', tests.recall('fenix_renewed_code') <> tests.recall('fenix_new_code'));
select tests.assert_equal(
  'vencido foi encerrado',
  (select revoked_at is not null from private.group_invites where code = tests.recall('fenix_new_code')),
  true
);
select tests.assert_equal(
  'um só convite aberto',
  (select count(*)::integer from private.group_invites where group_id = tests.recall('fenix')::uuid and revoked_at is null),
  1
);

-- caso: Legião com 50 membros não aceita mais ninguém
select tests.authenticate_as('carla');
select tests.remember('cheia_code', (select invite_code from public.create_group('Legião Cheia', 'loba')));
select tests.clear_authentication();
select tests.remember('cheia', (select group_id::text from public.group_members where user_id = tests.user_id('carla') and role = 'owner'));
select count(tests.create_member('lotacao_' || n, 'Membro ' || n)) from generate_series(1, 49) as n;
insert into public.group_members (group_id, user_id)
select tests.recall('cheia')::uuid, tests.user_id('lotacao_' || n) from generate_series(1, 49) as n;
select tests.authenticate_as('diego');
select tests.assert_equal(
  'prévia mostra a lotação',
  (select member_count from public.preview_invite(tests.recall('cheia_code'))),
  50
);
select tests.assert_equal(
  'entrada na Legião cheia',
  (select status || '|' || coalesce(group_id::text, '') from public.join_group_by_code(tests.recall('cheia_code'))),
  'group_full|'
);
select tests.clear_authentication();
select tests.authenticate_as('carla');
select tests.assert_raises(
  'convite de Legião cheia',
  format('select * from public.get_group_invite(%L)', tests.recall('cheia')),
  'group_full'
);
select tests.clear_authentication();

-- caso: ninguém participa de mais de 10 Legiões
select tests.authenticate_as('colecionador');
select tests.assert_equal(
  '10 Legiões fundadas',
  (select count(*)::integer from generate_series(1, 10) as n cross join lateral public.create_group('Legião ' || n, 'aguia')),
  10
);
select tests.assert_raises(
  '11ª fundação',
  $$select * from public.create_group('Legião Extra', 'aguia')$$,
  'group_limit_reached'
);
select tests.assert_equal(
  '11ª por convite',
  (select status from public.join_group_by_code(tests.recall('fenix_renewed_code'))),
  'group_limit_reached'
);
select tests.clear_authentication();

-- caso: fundar Legião tem limite por dia
select tests.create_member('inquieto', 'Inquieto', 'raio');
select tests.authenticate_as('inquieto');
select tests.assert_equal(
  '10 fundações',
  (select count(*)::integer from generate_series(1, 10) as n cross join lateral public.create_group('Tenda ' || n, 'loba')),
  10
);
select public.leave_group((select group_id from public.my_groups() where name = 'Tenda 10'));
select tests.assert_raises(
  '11ª fundação em 24 horas, mesmo com vaga',
  $$select * from public.create_group('Tenda Extra', 'loba')$$,
  'rate_limited'
);
select tests.clear_authentication();

-- caso: trocar o código tem limite por hora
select tests.authenticate_as('inquieto');
select tests.remember('tenda', (select group_id::text from public.my_groups() where name = 'Tenda 1'));
-- Laço explícito: numa junção lateral sem dependência da linha, a função rodaria uma vez só.
do $$
begin
  for n in 1..10 loop
    perform 1 from public.regenerate_invite(tests.recall('tenda')::uuid);
  end loop;
end;
$$;
select tests.assert_raises(
  '11ª troca na mesma hora',
  format('select * from public.regenerate_invite(%L)', tests.recall('tenda')),
  'rate_limited'
);
select tests.clear_authentication();

-- caso: entrar e sair em sequência tem limite de 20 entradas por dia
select tests.create_member('vaivem', 'Vai e Vem', 'pegaso');
select tests.authenticate_as('vaivem');
do $$
begin
  for n in 1..20 loop
    perform 1 from public.join_group_by_code(tests.recall('fenix_renewed_code'));
    perform public.leave_group(tests.recall('fenix')::uuid);
  end loop;
end;
$$;
select tests.assert_equal(
  '21ª entrada no mesmo dia',
  (select status from public.join_group_by_code(tests.recall('fenix_renewed_code'))),
  'rate_limited'
);
select tests.clear_authentication();

-- caso: Legião e membros ficam visíveis só para os membros
select tests.authenticate_as('diego');
select tests.assert_equal('Diego não vê Legiões', (select count(*)::integer from public.groups), 0);
select tests.assert_equal(
  'Diego não vê membros da Fênix',
  (select count(*)::integer from public.group_members where group_id = tests.recall('fenix')::uuid),
  0
);
select tests.clear_authentication();
select tests.authenticate_as('bruno');
select tests.assert_equal('Bruno vê só a Fênix', (select string_agg(name, ', ') from public.groups), 'Legião Fênix');
select tests.assert_equal(
  'Bruno vê os membros da Fênix',
  (select count(*)::integer from public.group_members where group_id = tests.recall('fenix')::uuid),
  3
);
select tests.assert_equal(
  'Bruno não vê membros da Legião Cheia',
  (select count(*)::integer from public.group_members where group_id = tests.recall('cheia')::uuid),
  0
);
select tests.clear_authentication();

-- caso: o app não grava Legiões, membros nem convites direto nas tabelas
select tests.authenticate_as('diego');
select tests.assert_raises(
  'entrar sem convite',
  format('insert into public.group_members (group_id, user_id) values (%L, %L)', tests.recall('fenix'), tests.user_id('diego')),
  'permission denied for table group_members'
);
select tests.clear_authentication();
select tests.authenticate_as('bruno');
select tests.assert_raises(
  'virar fundador',
  $$update public.group_members set role = 'owner'$$,
  'permission denied for table group_members'
);
select tests.assert_raises(
  'criar Legião direto',
  $$insert into public.groups (name, emblem) values ('Legião Direta', 'aguia')$$,
  'permission denied for table groups'
);
select tests.assert_raises('ler convites', $$select * from private.group_invites$$, 'permission denied for schema private');
select tests.assert_raises('ler tentativas', $$select * from private.join_attempts$$, 'permission denied for schema private');
select tests.assert_raises('ler auditoria', $$select * from private.audit_log$$, 'permission denied for schema private');
select tests.assert_raises(
  'chamar função interna',
  format('select private.is_group_member(%L)', tests.recall('fenix')),
  'permission denied for schema private'
);
select tests.clear_authentication();

-- caso: fundador que sai passa o posto ao membro mais antigo
-- Todos entraram na mesma transação; as datas de entrada são afastadas para a ordem ficar clara.
update public.group_members
set joined_at = now() - interval '2 hours'
where group_id = tests.recall('fenix')::uuid and user_id = tests.user_id('bruno');
update public.group_members
set joined_at = now() - interval '1 hour'
where group_id = tests.recall('fenix')::uuid and user_id = tests.user_id('forca');
select tests.authenticate_as('ana');
select public.leave_group(tests.recall('fenix')::uuid);
select tests.assert_raises(
  'Ana já não vê o convite',
  format('select * from public.get_group_invite(%L)', tests.recall('fenix')),
  'not_a_member'
);
select tests.assert_raises(
  'Ana não sai de novo',
  format('select public.leave_group(%L)', tests.recall('fenix')),
  'not_a_member'
);
select tests.clear_authentication();
select tests.assert_equal(
  'Bruno, o mais antigo, virou fundador',
  (
    select string_agg(p.display_name || ':' || gm.role, ', ' order by gm.joined_at)
    from public.group_members as gm
    join public.profiles as p on p.id = gm.user_id
    where gm.group_id = tests.recall('fenix')::uuid
  ),
  'Bruno:owner, Força Bruta:member'
);

-- caso: quando o último membro sai, a Legião é apagada
select tests.authenticate_as('colecionador');
select tests.remember('solo', (select group_id::text from public.my_groups() where name = 'Legião 1'));
select public.leave_group(tests.recall('solo')::uuid);
select tests.clear_authentication();
select tests.assert_equal(
  'Legião apagada',
  (select count(*)::integer from public.groups where id = tests.recall('solo')::uuid),
  0
);
select tests.assert_equal(
  'auditoria preservada sem a Legião',
  (
    select count(*)::integer from private.audit_log
    where actor_id = tests.user_id('colecionador') and action = 'group.left' and group_id is null
  ),
  1
);

-- caso: my_groups lista as Legiões do usuário com papel e tamanho
select tests.authenticate_as('bruno');
select tests.assert_equal(
  'Legiões do Bruno',
  (select string_agg(format('%s|%s|%s', name, role, member_count), ', ' order by joined_at) from public.my_groups()),
  'Legião Fênix|owner|2'
);
select tests.clear_authentication();
select tests.authenticate_as_anon();
select tests.assert_raises('anon', $$select * from public.my_groups()$$, 'permission denied for function my_groups');
select tests.clear_authentication();
