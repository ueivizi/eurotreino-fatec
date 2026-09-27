-- Rotas da Legião: um membro compartilha uma rota com a própria Legião, para os outros treinarem
-- nela. Só os membros veem; quem compartilhou e o fundador apagam; sair da Legião leva as rotas
-- da pessoa junto. O app esconde o começo e o fim antes de enviar (zona de privacidade), e o banco
-- confere o traçado e calcula a distância por conta própria.

-- Nome da rota: 2 a 40 caracteres, letras, números, espaço e . , ' ( ) / -
create function private.is_valid_route_name(p_value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    p_value is nfc normalized
    and char_length(p_value) between 2 and 40
    and p_value ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9]([A-Za-zÀ-ÖØ-öø-ÿ0-9 .,''()/-]*[A-Za-zÀ-ÖØ-öø-ÿ0-9.)])?$'
    and strpos(p_value, '  ') = 0,
    false
  );
$$;

-- Traçado: lista de 2 a 200 pares [longitude, latitude], todos números dentro do globo.
create function private.is_valid_route_points(p_points jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- CASE em vez de AND/OR: o Postgres não garante a ordem, e medir o que não é lista dá erro.
  select case
    when p_points is null or jsonb_typeof(p_points) <> 'array' then false
    when jsonb_array_length(p_points) not between 2 and 200 then false
    else not exists (
      select 1
      from jsonb_array_elements(p_points) as e (point)
      where case
        when jsonb_typeof(e.point) <> 'array' then true
        when jsonb_array_length(e.point) <> 2 then true
        when jsonb_typeof(e.point -> 0) <> 'number' or jsonb_typeof(e.point -> 1) <> 'number' then true
        else abs((e.point ->> 0)::numeric) > 180 or abs((e.point ->> 1)::numeric) > 90
      end
    )
  end;
$$;

-- Distância do traçado em metros (haversine, raio médio da Terra), a mesma conta do app.
create function private.route_distance_m(p_points jsonb)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  with pts as (
    select (e.point ->> 0)::double precision as lng, (e.point ->> 1)::double precision as lat, e.ord
    from jsonb_array_elements(p_points) with ordinality as e (point, ord)
  ),
  legs as (
    select
      lat, lng,
      lag(lat) over (order by ord) as prev_lat,
      lag(lng) over (order by ord) as prev_lng
    from pts
  )
  select coalesce(round(sum(
    2 * 6371008.8 * asin(least(1, sqrt(
      power(sin(radians(lat - prev_lat) / 2), 2)
      + cos(radians(prev_lat)) * cos(radians(lat)) * power(sin(radians(lng - prev_lng) / 2), 2)
    )))
  ))::integer, 0)
  from legs
  where prev_lat is not null;
$$;

create table public.legion_routes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  name text not null constraint legion_routes_name_valid check (private.is_valid_route_name(name)),
  modality text not null constraint legion_routes_modality_valid check (modality in ('pe', 'bike')),
  points jsonb not null constraint legion_routes_points_valid check (private.is_valid_route_points(points)),
  distance_m integer not null constraint legion_routes_distance_range check (distance_m between 100 and 200000),
  created_at timestamptz not null default now()
);

comment on table public.legion_routes is
  'Rotas compartilhadas com uma Legião. Leitura e escrita só pelas RPCs (legion_routes, share_route, delete_shared_route).';

create index legion_routes_group_idx on public.legion_routes (group_id, created_at desc);
create index legion_routes_author_idx on public.legion_routes (author_id, group_id);

-- RLS ligada e sem política: nenhum papel da API lê ou grava direto.
alter table public.legion_routes enable row level security;
revoke all on table public.legion_routes from public, anon, authenticated;

-- Quem sai da Legião leva as próprias rotas: o traçado era para quem treinava junto.
create function private.remove_routes_of_leaving_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.legion_routes as r where r.group_id = old.group_id and r.author_id = old.user_id;
  return old;
end;
$$;

create trigger group_members_remove_routes
after delete on public.group_members
for each row execute function private.remove_routes_of_leaving_member();

-- RPCs ------------------------------------------------------------------------------------------

create function public.share_route(p_group_id uuid, p_name text, p_modality text, p_points jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
  v_name constant text := btrim(p_name);
  v_distance integer;
  v_id uuid;
begin
  if not private.is_group_member(p_group_id) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  if not private.is_valid_route_name(v_name) then
    raise exception 'invalid_route_name' using errcode = 'P0001';
  end if;
  if p_modality is null or p_modality not in ('pe', 'bike') or not private.is_valid_route_points(p_points) then
    raise exception 'invalid_route' using errcode = 'P0001';
  end if;
  v_distance := private.route_distance_m(p_points);
  if v_distance < 100 or v_distance > 200000 then
    raise exception 'invalid_route' using errcode = 'P0001';
  end if;

  -- Serializa as rotas da Legião: o teto não é burlável em paralelo.
  perform 1 from public.groups as g where g.id = p_group_id for update;
  if private.recent_actions(v_user_id, null, 'route.shared', interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;
  if (select count(*) from public.legion_routes as r where r.group_id = p_group_id) >= 100 then
    raise exception 'route_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.legion_routes (group_id, author_id, name, modality, points, distance_m)
  values (p_group_id, v_user_id, v_name, p_modality, p_points, v_distance)
  returning id into v_id;
  perform private.audit(v_user_id, 'route.shared', p_group_id);
  return v_id;
end;
$$;

create function public.legion_routes(p_group_id uuid)
returns table (
  id uuid,
  name text,
  modality text,
  points jsonb,
  distance_m integer,
  created_at timestamptz,
  author_name text,
  is_mine boolean,
  can_delete boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_owner boolean;
begin
  if not private.is_group_member(p_group_id) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  select gm.role = 'owner' into v_owner
  from public.group_members as gm
  where gm.group_id = p_group_id and gm.user_id = v_user_id;

  return query
    select r.id, r.name, r.modality, r.points, r.distance_m, r.created_at, p.display_name,
           r.author_id = v_user_id, r.author_id = v_user_id or coalesce(v_owner, false)
    from public.legion_routes as r
    join public.profiles as p on p.id = r.author_id
    where r.group_id = p_group_id
    order by r.created_at desc
    limit 50;
end;
$$;

create function public.delete_shared_route(p_route_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
  v_group_id uuid;
  v_author_id uuid;
begin
  select r.group_id, r.author_id into v_group_id, v_author_id
  from public.legion_routes as r
  where r.id = p_route_id
  for update;

  -- Rota inexistente e rota de Legião alheia dão a mesma resposta: nada vaza.
  if v_group_id is null or not private.is_group_member(v_group_id) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  if v_author_id <> v_user_id and not exists (
    select 1 from public.group_members as gm
    where gm.group_id = v_group_id and gm.user_id = v_user_id and gm.role = 'owner'
  ) then
    raise exception 'cannot_delete_route' using errcode = 'P0001';
  end if;

  delete from public.legion_routes as r where r.id = p_route_id;
  perform private.audit(v_user_id, 'route.deleted', v_group_id);
end;
$$;

-- Privilégios ----------------------------------------------------------------------------------

revoke all on function private.is_valid_route_name(text) from public;
revoke all on function private.is_valid_route_points(jsonb) from public;
revoke all on function private.route_distance_m(jsonb) from public;
revoke all on function private.remove_routes_of_leaving_member() from public;
revoke all on function public.share_route(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.legion_routes(uuid) from public, anon, authenticated;
revoke all on function public.delete_shared_route(uuid) from public, anon, authenticated;
grant execute on function public.share_route(uuid, text, text, jsonb) to authenticated;
grant execute on function public.legion_routes(uuid) to authenticated;
grant execute on function public.delete_shared_route(uuid) to authenticated;
