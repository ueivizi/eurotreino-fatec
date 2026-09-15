-- NF013/LGPD: tentativas de código inválido duram 1 dia e eventos de segurança, 90 dias.
-- No projeto hospedado as tabelas já têm dados reais: as conferências olham só as linhas deste teste.

select tests.create_member('ana', 'Ana', 'aguia');
select tests.create_member('bruno', 'Bruno', 'leao');

insert into private.join_attempts (user_id, attempted_at)
values
  (tests.user_id('ana'), now() - interval '2 days'),
  (tests.user_id('ana'), now() - interval '23 hours'),
  (tests.user_id('bruno'), now() - interval '5 minutes');

with inserted as (
  insert into private.audit_log (actor_id, action, occurred_at)
  values
    (tests.user_id('ana'), 'group.created', now() - interval '91 days'),
    (tests.user_id('ana'), 'group.joined', now() - interval '89 days'),
    (null, 'invite.issued', now() - interval '120 days'),
    (tests.user_id('bruno'), 'profile.updated', now())
  returning id
)
select tests.remember('eventos', (select string_agg(id::text, ',') from inserted));

-- caso: a limpeza apaga só o que passou do prazo
select private.prune_expired_security_data();
select tests.assert_equal(
  'tentativas restantes',
  (
    select format(
      'Ana %s, Bruno %s',
      (select count(*) from private.join_attempts where user_id = tests.user_id('ana')),
      (select count(*) from private.join_attempts where user_id = tests.user_id('bruno'))
    )
  ),
  'Ana 1, Bruno 1'
);
select tests.assert_equal(
  'eventos restantes',
  (
    select string_agg(action, ', ' order by action)
    from private.audit_log
    where id = any (string_to_array(tests.recall('eventos'), ',')::bigint[])
  ),
  'group.joined, profile.updated'
);

-- caso: só o banco executa a limpeza
select tests.authenticate_as('ana');
select tests.assert_raises(
  'authenticated chamando a limpeza',
  $$select private.prune_expired_security_data()$$,
  'permission denied for schema private'
);
select tests.clear_authentication();
