-- Cota do roteador: a Edge Function "rotas" chama claim_route_request com o token da pessoa antes
-- de cada pedido ao OpenRouteService. O banco só conta pedidos; coordenada nenhuma passa por aqui.

select tests.create_member('ciclista', 'Ciclista', 'raio');

-- caso: quem não entrou não usa o roteador
select tests.authenticate_as_anon();
select tests.assert_raises('sem login', $$select public.claim_route_request()$$, 'permission denied for function claim_route_request');

-- caso: cada pedido fica registrado, sem coordenada
select tests.authenticate_as('ciclista');
select public.claim_route_request();
select tests.clear_authentication();
select tests.assert_equal(
  'um pedido registrado',
  (select count(*)::integer from private.audit_log as al where al.action = 'route.requested' and al.actor_id = tests.user_id('ciclista')),
  1
);

-- caso: 20 pedidos por hora, depois recusa
select tests.authenticate_as('ciclista');
do $$
begin
  for i in 1..19 loop
    perform public.claim_route_request();
  end loop;
end;
$$;
select tests.assert_raises('21º pedido na hora', $$select public.claim_route_request()$$, 'rate_limited');

-- caso: 60 pedidos por dia, mesmo espalhados pelas horas
select tests.clear_authentication();
update private.audit_log as al
set occurred_at = now() - interval '5 hours'
where al.action = 'route.requested' and al.actor_id = tests.user_id('ciclista');
insert into private.audit_log (actor_id, action, occurred_at)
select tests.user_id('ciclista'), 'route.requested', now() - interval '10 hours'
from generate_series(1, 40);
select tests.authenticate_as('ciclista');
select tests.assert_raises('61º pedido no dia', $$select public.claim_route_request()$$, 'rate_limited');
