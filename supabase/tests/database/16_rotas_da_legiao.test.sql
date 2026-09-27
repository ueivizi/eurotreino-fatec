-- Rotas da Legião: só membros veem e compartilham; quem compartilhou e o fundador apagam; sair da
-- Legião leva as rotas da pessoa. O banco confere o traçado e calcula a distância.

select tests.create_member('fundadora', 'Fundadora', 'aguia');
select tests.create_member('corredor', 'Corredor', 'raio');
select tests.create_member('ciclista', 'Ciclista', 'leao');
select tests.create_member('estranho', 'Estranho', 'loba');
select tests.create_legion('trilha', 'Legião da Trilha', array['fundadora', 'corredor', 'ciclista']);

-- ~555 m numa reta norte-sul, com um ponto no meio.
select tests.remember(
  'tracado',
  '[[-46.63, -23.55], [-46.63, -23.5475], [-46.63, -23.545]]'
);

-- caso: quem não entrou não compartilha nem lê
select tests.authenticate_as_anon();
select tests.assert_raises(
  'anon compartilha',
  $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'pe', tests.recall('tracado')::jsonb)$$,
  'permission denied for function share_route'
);
select tests.assert_raises('anon lê', $$select * from public.legion_routes(tests.recall('trilha')::uuid)$$, 'permission denied for function legion_routes');

-- caso: a tabela não é lida nem gravada direto
select tests.authenticate_as('corredor');
select tests.assert_raises('select direto', $$select count(*) from public.legion_routes$$, 'permission denied for table legion_routes');

-- caso: membro compartilha e a distância vem do banco
select tests.authenticate_as('corredor');
select tests.remember(
  'rota_corredor',
  public.share_route(tests.recall('trilha')::uuid, 'Volta da Paulista, 5,2 km', 'pe', tests.recall('tracado')::jsonb)::text
);
select tests.assert_equal(
  'rota na lista',
  (
    select format('%s|%s|%s|%s|%s', r.name, r.modality, r.distance_m between 550 and 560, r.author_name, r.is_mine)
    from public.legion_routes(tests.recall('trilha')::uuid) as r
  ),
  'Volta da Paulista, 5,2 km|pe|t|Corredor|t'
);

-- caso: quem não é da Legião não compartilha, não lê e não apaga
select tests.authenticate_as('estranho');
select tests.assert_raises(
  'estranho compartilha',
  $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'pe', tests.recall('tracado')::jsonb)$$,
  'not_a_member'
);
select tests.assert_raises('estranho lê', $$select * from public.legion_routes(tests.recall('trilha')::uuid)$$, 'not_a_member');
select tests.assert_raises('estranho apaga', $$select public.delete_shared_route(tests.recall('rota_corredor')::uuid)$$, 'not_a_member');

-- caso: nome e traçado fora da regra são recusados
select tests.authenticate_as('ciclista');
select tests.assert_raises('nome curto', $$select public.share_route(tests.recall('trilha')::uuid, 'V', 'pe', tests.recall('tracado')::jsonb)$$, 'invalid_route_name');
select tests.assert_raises('nome com tag', $$select public.share_route(tests.recall('trilha')::uuid, '<b>Volta</b>', 'pe', tests.recall('tracado')::jsonb)$$, 'invalid_route_name');
select tests.assert_raises('modalidade', $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'carro', tests.recall('tracado')::jsonb)$$, 'invalid_route');
select tests.assert_raises('um ponto só', $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'pe', '[[-46.63, -23.55]]')$$, 'invalid_route');
select tests.assert_raises('fora do globo', $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'pe', '[[-46.63, -23.55], [200, 0]]')$$, 'invalid_route');
select tests.assert_raises('ponto em texto', $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'pe', '[[-46.63, -23.55], ["a", "b"]]')$$, 'invalid_route');
select tests.assert_raises('objeto', $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'pe', '{"a": 1}')$$, 'invalid_route');
select tests.assert_raises('ponto que não é par', $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'pe', '[[-46.63, -23.55], 5]')$$, 'invalid_route');
select tests.assert_raises('curta demais', $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'pe', '[[-46.63, -23.55], [-46.63, -23.5501]]')$$, 'invalid_route');
select tests.assert_raises(
  'pontos demais',
  $$select public.share_route(tests.recall('trilha')::uuid, 'Volta', 'bike', (select jsonb_agg(jsonb_build_array(-46.63, -23.55 + i * 0.0001)) from generate_series(1, 201) as i))$$,
  'invalid_route'
);

-- caso: outro membro vê, mas só quem compartilhou e o fundador apagam
select tests.authenticate_as('ciclista');
select tests.assert_equal(
  'ciclista não apaga a do corredor',
  (select format('%s %s', r.is_mine, r.can_delete) from public.legion_routes(tests.recall('trilha')::uuid) as r),
  'f f'
);
select tests.assert_raises('ciclista apaga', $$select public.delete_shared_route(tests.recall('rota_corredor')::uuid)$$, 'cannot_delete_route');
select tests.authenticate_as('fundadora');
select tests.assert_equal(
  'fundadora pode apagar',
  (select r.can_delete from public.legion_routes(tests.recall('trilha')::uuid) as r),
  true
);
select public.delete_shared_route(tests.recall('rota_corredor')::uuid);
select tests.assert_equal('apagada', (select count(*)::integer from public.legion_routes(tests.recall('trilha')::uuid)), 0);

-- caso: sair da Legião leva as rotas de quem saiu
select tests.authenticate_as('ciclista');
select public.share_route(tests.recall('trilha')::uuid, 'Pedal do parque', 'bike', tests.recall('tracado')::jsonb);
select public.leave_group(tests.recall('trilha')::uuid);
select tests.authenticate_as('fundadora');
select tests.assert_equal('rota foi junto', (select count(*)::integer from public.legion_routes(tests.recall('trilha')::uuid)), 0);

-- caso: 10 rotas por hora
select tests.authenticate_as('corredor');
do $$
begin
  for i in 1..9 loop
    perform public.share_route(tests.recall('trilha')::uuid, format('Volta %s', i), 'pe', tests.recall('tracado')::jsonb);
  end loop;
end;
$$;
select tests.assert_raises(
  '11ª na hora',
  $$select public.share_route(tests.recall('trilha')::uuid, 'Volta extra', 'pe', tests.recall('tracado')::jsonb)$$,
  'rate_limited'
);
