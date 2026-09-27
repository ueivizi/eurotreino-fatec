-- Escolhas de dados e foto de perfil.
--
-- Os envios de arquivo são simulados gravando em storage.objects com o papel da pessoa, que é o
-- que o serviço de Storage faz depois de conferir as mesmas políticas de RLS.

select tests.create_member('fotografa', 'Fotógrafa', 'aguia');
select tests.create_member('colega', 'Colega', 'leao');
select tests.create_member('intruso', 'Intruso', 'loba');
select tests.create_legion('foto', 'Legião da Foto', array['fotografa', 'colega']);

-- ---------------------------------------------------------------------------------------------
-- Escolhas

select tests.authenticate_as('fotografa');

-- caso: nada vem ligado, e o próprio perfil mostra as escolhas
select tests.assert_equal(
  'tudo desligado',
  (
    select format('%s %s %s %s', p.health_consent_at is null, p.photo_consent_at is null, p.location_consent_at is null, p.avatar_updated_at is null)
    from public.my_profile() as p
  ),
  't t t t'
);

-- caso: finalidade desconhecida é recusada
select tests.assert_raises('finalidade inventada', $$select public.set_data_consent('biometria', true)$$, 'invalid_consent');
select tests.assert_raises('sem resposta', $$select public.set_data_consent('foto', null)$$, 'invalid_consent');

-- caso: ligar e desligar a localização
select tests.assert_true('ligou a localização', public.set_data_consent('localizacao', true) is not null);
select tests.assert_equal('desligou a localização', public.set_data_consent('localizacao', false), null::timestamptz);
select tests.assert_true('continua desligada', (select p.location_consent_at is null from public.my_profile() as p));

-- caso: membro da Legião não lê as datas de consentimento dos outros direto da tabela
select tests.authenticate_as('colega');
select tests.assert_raises(
  'consentimento de saúde alheio',
  format($$select health_consent_at from public.profiles where id = %L$$, tests.user_id('fotografa')),
  'permission denied%'
);
select tests.assert_raises(
  'consentimento de foto alheio',
  format($$select photo_consent_at from public.profiles where id = %L$$, tests.user_id('fotografa')),
  'permission denied%'
);
select tests.assert_equal(
  'a vitrine continua legível',
  (select display_name from public.profiles where id = tests.user_id('fotografa')),
  'Fotógrafa'
);

-- ---------------------------------------------------------------------------------------------
-- Foto

-- caso: sem consentimento não se envia foto nem se marca como trocada
select tests.authenticate_as('fotografa');
select tests.assert_raises(
  'envio sem consentimento',
  format($$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, %L)$$, tests.user_id('fotografa') || '/avatar.jpg', tests.user_id('fotografa')),
  'new row violates row-level security policy%'
);
select tests.assert_raises('marcar sem consentimento', $$select public.set_avatar(true)$$, 'photo_consent_required');

-- caso: com consentimento, envia a própria foto, mas nunca no lugar da de outra pessoa
select public.set_data_consent('foto', true);
select tests.assert_raises('marcar antes de enviar', $$select public.set_avatar(true)$$, 'avatar_not_uploaded');
insert into storage.objects (bucket_id, name, owner) values ('avatars', tests.user_id('fotografa') || '/avatar.jpg', tests.user_id('fotografa'));
select tests.assert_true('foto marcada', public.set_avatar(true) is not null);
select tests.assert_raises(
  'foto no caminho da Colega',
  format($$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, %L)$$, tests.user_id('colega') || '/avatar.jpg', tests.user_id('fotografa')),
  'new row violates row-level security policy%'
);
select tests.assert_raises(
  'nome fora do padrão',
  format($$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, %L)$$, tests.user_id('fotografa') || '/outra.jpg', tests.user_id('fotografa')),
  'new row violates row-level security policy%'
);

-- caso: quem divide a Legião vê a foto; quem não divide, não
select tests.authenticate_as('colega');
select tests.assert_equal('a Colega vê', (select count(*)::integer from storage.objects where bucket_id = 'avatars'), 1);
select tests.assert_equal(
  'fotos da Legião',
  (select string_agg(p.user_id::text, ',') from public.legion_photos(tests.recall('foto')::uuid) as p),
  tests.user_id('fotografa')::text
);
select tests.authenticate_as('intruso');
select tests.assert_equal('o Intruso não vê', (select count(*)::integer from storage.objects where bucket_id = 'avatars'), 0);
select tests.assert_raises('fotos de Legião alheia', format($$select * from public.legion_photos(%L)$$, tests.recall('foto')), 'not_a_member');

-- caso: desligar a foto a esconde na hora, mesmo antes de o arquivo ser apagado
select tests.authenticate_as('fotografa');
select public.set_data_consent('foto', false);
select tests.assert_true('referência apagada', (select p.avatar_updated_at is null from public.my_profile() as p));
select tests.authenticate_as('colega');
select tests.assert_equal('a Colega não vê mais', (select count(*)::integer from storage.objects where bucket_id = 'avatars'), 0);
select tests.assert_equal('nem na lista', (select count(*)::integer from public.legion_photos(tests.recall('foto')::uuid)), 0);

-- caso: sem consentimento, a própria pessoa ainda enxerga o arquivo que sobrou, que é o que a
-- política de apagar exige. (O apagar em si é pela API de Storage: o projeto hospedado recusa
-- DELETE direto em storage.objects, então o teste não apaga por SQL.)
select tests.authenticate_as('fotografa');
select tests.assert_equal(
  'a dona ainda vê a própria foto',
  (select count(*)::integer from storage.objects where bucket_id = 'avatars' and name = tests.user_id('fotografa') || '/avatar.jpg'),
  1
);

-- caso: o bucket é privado, pequeno e só aceita JPEG
select tests.clear_authentication();
select tests.assert_equal(
  'bucket',
  (select format('%s %s %s', public, file_size_limit, allowed_mime_types) from storage.buckets where id = 'avatars'),
  'f 524288 {image/jpeg}'
);
