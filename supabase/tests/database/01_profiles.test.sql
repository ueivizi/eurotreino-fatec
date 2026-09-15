-- RF002 perfil inicial · RF009 perfis visíveis só para quem compartilha Legião.

select tests.create_user('ana');
select tests.create_member('carla', 'Carla', 'coruja');
select tests.create_member('diego', 'Diego', 'raio');
select tests.create_member('eva', 'Eva', 'leao');
select tests.create_member('fabio', 'Fábio', 'raio');
select tests.create_legion('fenix', 'Legião Fênix', array['carla', 'diego']);

-- caso: anon é barrado antes de chegar à função
select tests.authenticate_as_anon();
select tests.assert_raises(
  'anon chamando complete_profile',
  $$select public.complete_profile('Ana', 'aguia')$$,
  'permission denied for function complete_profile'
);
select tests.clear_authentication();

-- caso: sessão sem usuário identificado não cria perfil
select set_config('role', 'authenticated', true);
select tests.assert_raises(
  'authenticated sem sub no token',
  $$select public.complete_profile('Ana', 'aguia')$$,
  'not_authenticated'
);
select tests.clear_authentication();

-- caso: nome de exibição fora das regras é recusado
select tests.authenticate_as('ana');
select tests.assert_raises('1 caractere', $$select public.complete_profile('A', 'aguia')$$, 'invalid_display_name');
select tests.assert_raises(
  '33 caracteres',
  $$select public.complete_profile(repeat('a', 33), 'aguia')$$,
  'invalid_display_name'
);
select tests.assert_raises(
  'texto gigante',
  $$select public.complete_profile(repeat('a', 100000), 'aguia')$$,
  'invalid_display_name'
);
select tests.assert_raises('só espaços', $$select public.complete_profile('   ', 'aguia')$$, 'invalid_display_name');
select tests.assert_raises('nulo', $$select public.complete_profile(null, 'aguia')$$, 'invalid_display_name');
select tests.assert_raises(
  'espaço duplo',
  $$select public.complete_profile('Ana  Clara', 'aguia')$$,
  'invalid_display_name'
);
select tests.assert_raises(
  'marcação HTML',
  $$select public.complete_profile('<b>Ana</b>', 'aguia')$$,
  'invalid_display_name'
);
select tests.assert_raises(
  'quebra de linha',
  $$select public.complete_profile(E'Ana\nClara', 'aguia')$$,
  'invalid_display_name'
);
select tests.assert_raises('emoji', $$select public.complete_profile('Ana 💪', 'aguia')$$, 'invalid_display_name');
select tests.clear_authentication();

-- caso: emblema fora da lista é recusado
select tests.authenticate_as('ana');
select tests.assert_raises('emblema inventado', $$select public.complete_profile('Ana', 'fenix')$$, 'invalid_emblem');
select tests.assert_raises('emblema nulo', $$select public.complete_profile('Ana', null)$$, 'invalid_emblem');
select tests.clear_authentication();

-- caso: perfil criado com o nome aparado e normalizado (NFC)
select tests.authenticate_as('ana');
-- A entrada usa acentos decompostos (letra + acento combinante), como alguns teclados enviam.
select tests.assert_equal(
  'nome devolvido',
  (public.complete_profile(E'  Te\u0301o D''A\u0301vila-Jr.  ', 'loba')).display_name,
  'Téo D''Ávila-Jr.'
);
select tests.clear_authentication();
select tests.assert_equal(
  'nome gravado em NFC',
  (select display_name from public.profiles where id = tests.user_id('ana')),
  'Téo D''Ávila-Jr.'
);

-- caso: completar de novo atualiza o próprio perfil, sem duplicar
select tests.authenticate_as('ana');
select public.complete_profile('Ana', 'aguia');
select public.complete_profile('Ana Clara', 'coruja');
select tests.clear_authentication();
select tests.assert_equal(
  'um só perfil',
  (select count(*)::integer from public.profiles where id = tests.user_id('ana')),
  1
);
select tests.assert_equal(
  'perfil atualizado',
  (select display_name || ' · ' || emblem from public.profiles where id = tests.user_id('ana')),
  'Ana Clara · coruja'
);

-- caso: o app não grava perfis direto na tabela
select tests.authenticate_as('carla');
select tests.assert_raises(
  'insert direto',
  format($$insert into public.profiles (id, display_name, emblem) values (%L, 'Falsa', 'aguia')$$, gen_random_uuid()),
  'permission denied for table profiles'
);
select tests.assert_raises(
  'update direto',
  $$update public.profiles set display_name = 'Outro nome'$$,
  'permission denied for table profiles'
);
select tests.assert_raises('delete direto', $$delete from public.profiles$$, 'permission denied for table profiles');
select tests.clear_authentication();

-- caso: perfis visíveis só para quem compartilha Legião
select tests.authenticate_as('carla');
select tests.assert_equal(
  'Carla vê a si e ao Diego',
  (select string_agg(display_name, ', ' order by display_name) from public.profiles),
  'Carla, Diego'
);
select tests.assert_equal(
  'Carla não encontra a Eva nem pelo id',
  (select count(*)::integer from public.profiles where id = tests.user_id('eva')),
  0
);
select tests.clear_authentication();
select tests.authenticate_as('eva');
select tests.assert_equal(
  'Eva, sem Legião, só vê a si',
  (select string_agg(display_name, ', ' order by display_name) from public.profiles),
  'Eva'
);
select tests.clear_authentication();

-- caso: anon não lê perfis
select tests.authenticate_as_anon();
select tests.assert_raises('select como anon', $$select * from public.profiles$$, 'permission denied for table profiles');
select tests.clear_authentication();

-- caso: salvar o perfil sem mudanças não grava nem conta como edição
select tests.authenticate_as('fabio');
select public.complete_profile('Fábio', 'raio');
select tests.clear_authentication();
select tests.assert_equal(
  'edições registradas',
  (select count(*)::integer from private.audit_log where actor_id = tests.user_id('fabio') and action = 'profile.updated'),
  0
);

-- caso: no máximo 10 edições de perfil em 24 horas
select tests.authenticate_as('fabio');
do $$
begin
  for i in 1..10 loop
    perform public.complete_profile('Fábio ' || i, 'raio');
  end loop;
end;
$$;
select tests.assert_raises('11ª edição', $$select public.complete_profile('Fábio 11', 'raio')$$, 'rate_limited');
select tests.assert_equal(
  'salvar igual continua funcionando no limite',
  (public.complete_profile('Fábio 10', 'raio')).display_name,
  'Fábio 10'
);
select tests.clear_authentication();
select tests.assert_equal(
  'perfil ficou com a 10ª edição',
  (select display_name || ' · ' || emblem from public.profiles where id = tests.user_id('fabio')),
  'Fábio 10 · raio'
);

-- caso: edições com mais de 24 horas deixam de contar
update private.audit_log
set occurred_at = now() - interval '25 hours'
where actor_id = tests.user_id('fabio') and action = 'profile.updated';
select tests.authenticate_as('fabio');
select tests.assert_equal(
  'edição depois da janela',
  (public.complete_profile('Fábio', 'aguia')).emblem,
  'aguia'
);
select tests.clear_authentication();
