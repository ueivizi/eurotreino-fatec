-- Mural da Legião: conversa entre membros, com moderação desde o primeiro commit.
--
-- O que estes casos protegem, em ordem de importância: ninguém de fora lê ou escreve, link não
-- passa, quem denuncia para de ver na hora, três denúncias escondem de todos, e a decisão do
-- fundador vale mais que a contagem de denúncias.

select tests.create_member('fundador', 'Digão', 'raio');
select tests.create_member('membro', 'Camila', 'coruja');
select tests.create_member('outro_membro', 'Lucas', 'aguia');
select tests.create_member('terceiro', 'Bia', 'tridente');
select tests.create_member('quarto', 'Tânia', 'leao');
select tests.create_member('forasteiro', 'Estranho', 'elmo');

select tests.create_legion('legiao', 'Legião Fênix', array['fundador', 'membro', 'outro_membro', 'terceiro', 'quarto']);

-- caso: membro escreve e o mural mostra com nome e emblema
select tests.authenticate_as('membro');
select tests.remember(
  'msg1',
  (select m.message_id::text from public.post_message(tests.recall('legiao')::uuid, 'Domingo 7h no parque, quem vai?') as m)
);
select tests.assert_equal(
  'a mensagem aparece com quem escreveu',
  (
    select format('%s (%s): %s · minha %s', m.display_name, m.emblem, m.body, m.is_mine)
    from public.group_mural(tests.recall('legiao')::uuid) as m
  ),
  'Camila (coruja): Domingo 7h no parque, quem vai? · minha t'
);

-- caso: o mural não aceita link
select tests.assert_raises(
  'link no meio da frase',
  format($$select * from public.post_message('%s'::uuid, 'olha isso https://bit.ly/oferta')$$, tests.recall('legiao')),
  'link_not_allowed'
);
select tests.assert_raises(
  'endereço sem protocolo',
  format($$select * from public.post_message('%s'::uuid, 'entra em ganhe-dinheiro.xyz hoje')$$, tests.recall('legiao')),
  'link_not_allowed'
);
select tests.assert_equal(
  'nenhuma delas foi gravada',
  (select count(*)::integer from public.group_messages),
  1
);

-- caso: texto vazio, só espaço ou grande demais não passa
select tests.assert_raises(
  'mensagem em branco',
  format($$select * from public.post_message('%s'::uuid, '   ')$$, tests.recall('legiao')),
  'invalid_message'
);
select tests.assert_raises(
  'mensagem de 501 caracteres',
  format($$select * from public.post_message('%s'::uuid, repeat('a', 501))$$, tests.recall('legiao')),
  'invalid_message'
);

select tests.clear_authentication();

-- caso: caracteres de controle somem e o parágrafo vazio repetido vira um só
select tests.assert_equal(
  'texto limpo na entrada',
  private.clean_message(E'  bora treinar\u0007\n\n\n\n\nhoje  '),
  E'bora treinar\n\nhoje'
);

-- caso: quem não é da Legião não lê nem escreve
select tests.authenticate_as('forasteiro');
select tests.assert_raises(
  'forasteiro lendo o mural',
  format($$select * from public.group_mural('%s'::uuid)$$, tests.recall('legiao')),
  'not_a_member'
);
select tests.assert_raises(
  'forasteiro escrevendo no mural',
  format($$select * from public.post_message('%s'::uuid, 'oi')$$, tests.recall('legiao')),
  'not_a_member'
);
select tests.assert_equal(
  'e a tabela não mostra nada para ele',
  (select count(*)::integer from public.group_messages),
  0
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- Apagar

select tests.authenticate_as('outro_membro');
select tests.remember(
  'msg2',
  (select m.message_id::text from public.post_message(tests.recall('legiao')::uuid, 'Tô 12 atrás do Digão. Hoje eu viro.') as m)
);
select tests.assert_raises(
  'membro apagando mensagem alheia',
  format($$select public.delete_message('%s'::uuid)$$, tests.recall('msg1')),
  'not_group_owner'
);
select public.delete_message(tests.recall('msg2')::uuid);
select tests.assert_equal(
  'quem escreveu apaga a própria',
  (select count(*)::integer from public.group_messages as m where m.id = tests.recall('msg2')::uuid),
  0
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- Denúncia

select tests.authenticate_as('membro');
select tests.remember(
  'alvo',
  (select m.message_id::text from public.post_message(tests.recall('legiao')::uuid, 'mensagem que vai ser denunciada') as m)
);
select tests.assert_raises(
  'denunciar a própria mensagem',
  format($$select * from public.report_message('%s'::uuid)$$, tests.recall('alvo')),
  'cannot_report_own'
);
select tests.clear_authentication();

-- caso: quem denuncia para de ver a mensagem na hora, mesmo com uma denúncia só
select tests.authenticate_as('outro_membro');
select tests.assert_equal(
  'primeira denúncia não esconde de todos',
  (select format('%s denúncias, retida %s', r.reports_count, r.is_held) from public.report_message(tests.recall('alvo')::uuid) as r),
  '1 denúncias, retida f'
);
select tests.assert_equal(
  'mas some para quem denunciou',
  (select count(*)::integer from public.group_mural(tests.recall('legiao')::uuid) as m where m.message_id = tests.recall('alvo')::uuid),
  0
);
select tests.clear_authentication();

select tests.authenticate_as('terceiro');
select tests.assert_equal(
  'e continua visível para quem não denunciou',
  (select count(*)::integer from public.group_mural(tests.recall('legiao')::uuid) as m where m.message_id = tests.recall('alvo')::uuid),
  1
);
select public.report_message(tests.recall('alvo')::uuid);
select tests.clear_authentication();

-- caso: a terceira denúncia esconde a mensagem de todo mundo
select tests.authenticate_as('quarto');
select tests.assert_equal(
  'terceira denúncia retém',
  (select format('%s denúncias, retida %s', r.reports_count, r.is_held) from public.report_message(tests.recall('alvo')::uuid) as r),
  '3 denúncias, retida t'
);
select tests.clear_authentication();

select tests.authenticate_as('terceiro');
select tests.assert_equal(
  'retida some para quem não é o fundador nem o autor',
  (select count(*)::integer from public.group_mural(tests.recall('legiao')::uuid) as m where m.message_id = tests.recall('alvo')::uuid),
  0
);
select tests.clear_authentication();

select tests.authenticate_as('membro');
select tests.assert_equal(
  'quem escreveu ainda vê a própria mensagem retida',
  (select count(*)::integer from public.group_mural(tests.recall('legiao')::uuid) as m where m.message_id = tests.recall('alvo')::uuid),
  1
);
select tests.clear_authentication();

-- caso: o fundador vê a mensagem retida, com a contagem, e pode liberar
select tests.authenticate_as('fundador');
select tests.assert_equal(
  'o fundador vê retida e sabe quantas denúncias',
  (
    select format('retida %s, %s denúncias', m.is_held, m.reports_count)
    from public.group_mural(tests.recall('legiao')::uuid) as m
    where m.message_id = tests.recall('alvo')::uuid
  ),
  'retida t, 3 denúncias'
);
select public.clear_message_reports(tests.recall('alvo')::uuid);
select tests.assert_equal(
  'liberada volta a aparecer',
  (
    select format('retida %s', m.is_held)
    from public.group_mural(tests.recall('legiao')::uuid) as m
    where m.message_id = tests.recall('alvo')::uuid
  ),
  'retida f'
);
select tests.clear_authentication();

-- caso: depois de liberada, denúncia nova não esconde de novo -- a decisão do fundador vale mais
select tests.authenticate_as('fundador');
select tests.assert_equal(
  'quarta denúncia não retém a liberada',
  (select format('%s denúncias, retida %s', r.reports_count, r.is_held) from public.report_message(tests.recall('alvo')::uuid) as r),
  '4 denúncias, retida f'
);
-- Moderar exige enxergar: o fundador continua vendo a mensagem que ele mesmo denunciou.
select tests.assert_equal(
  'o fundador vê até o que denunciou',
  (select count(*)::integer from public.group_mural(tests.recall('legiao')::uuid) as m where m.message_id = tests.recall('alvo')::uuid),
  1
);
select tests.clear_authentication();

-- caso: só o fundador libera
select tests.authenticate_as('outro_membro');
select tests.assert_raises(
  'membro liberando mensagem',
  format($$select public.clear_message_reports('%s'::uuid)$$, tests.recall('alvo')),
  'not_group_owner'
);
select tests.clear_authentication();

-- caso: o fundador apaga a mensagem de quem for
select tests.authenticate_as('fundador');
select public.delete_message(tests.recall('alvo')::uuid);
select tests.assert_equal(
  'mensagem apagada leva as denúncias junto',
  (select count(*)::integer from public.message_reports),
  0
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- Limites e privacidade

-- caso: 30 mensagens por hora, e a 31ª espera
select tests.authenticate_as('terceiro');
do $$
begin
  for i in 1..30 loop
    perform public.post_message(tests.recall('legiao')::uuid, format('mensagem %s', i));
  end loop;
end;
$$;
select tests.assert_raises(
  'inundar o mural',
  format($$select * from public.post_message('%s'::uuid, 'mais uma')$$, tests.recall('legiao')),
  'rate_limited'
);
select tests.clear_authentication();

-- caso: apagar a conta leva as mensagens junto (LGPD)
delete from public.profiles as p where p.id = tests.user_id('terceiro');
select tests.assert_equal(
  'mensagens da conta apagada somem',
  (select count(*)::integer from public.group_messages as m where m.author_id = tests.user_id('terceiro')),
  0
);

select tests.authenticate_as_anon();
select tests.assert_raises('anon não lê o mural', $$select * from public.group_mural(gen_random_uuid())$$, 'permission denied for function group_mural');
select tests.assert_raises('anon não escreve', $$select * from public.post_message(gen_random_uuid(), 'oi')$$, 'permission denied for function post_message');
select tests.assert_raises('anon não lê a tabela', $$select count(*) from public.group_messages$$, 'permission denied for table group_messages');
select tests.clear_authentication();
