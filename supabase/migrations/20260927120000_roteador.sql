-- Roteador (OpenRouteService, pela Edge Function "rotas"): rota que segue ruas e ciclovias e voltas
-- geradas a partir de um ponto. O banco não guarda coordenadas: só conta os pedidos de cada pessoa,
-- para ninguém gastar a cota gratuita de todos (2.000 rotas por dia no plano da HeiGIT).

create function public.claim_route_request()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
begin
  -- Serializa os pedidos da pessoa: o limite não é burlável em paralelo.
  perform 1 from public.profiles as p where p.id = v_user_id for update;

  if private.recent_actions(v_user_id, null, 'route.requested', interval '1 hour') >= 20
     or private.recent_actions(v_user_id, null, 'route.requested', interval '24 hours') >= 60 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  perform private.audit(v_user_id, 'route.requested', null);
end;
$$;

comment on function public.claim_route_request() is
  'Chamada pela Edge Function rotas com o token da pessoa antes de cada pedido ao roteador: 20 por hora, 60 por dia.';

revoke all on function public.claim_route_request() from public, anon, authenticated;
grant execute on function public.claim_route_request() to authenticated;
