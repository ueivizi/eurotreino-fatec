-- Modos de Legião e estandarte.
--
-- Clássica: o Coliseu semanal de sempre. Ninguém perde nada; é o modo de quem está começando.
--
-- Competitiva: temporadas de 4 semanas com Louros que sobem e descem. A cada semana fechada:
--   * cumpriu o mínimo da Legião (2, 3 ou 4 treinos pontuados, escolhido pelo fundador): +10;
--     não cumpriu: -15;
--   * pódio da semana, entre quem pontuou: +15, +10 e +5;
--   * os Louros nunca ficam negativos.
-- **A Glória continua sem cair**: Louros são da temporada daquela Legião, não do rank da pessoa.
-- No fim da temporada, o pódio da tabela ganha Triunfos de ouro, prata e bronze, e quem cumpriu o
-- mínimo nas 4 semanas ganha o Triunfo "Invicto". Triunfos ficam no perfil mesmo depois de sair.
--
-- Uma semana só conta para quem já era membro quando ela começou: entrar no meio não pune nem
-- premia. A temporada competitiva começa sempre na segunda-feira seguinte à escolha do modo.
--
-- Estandarte: a cor do pano vem da mesma lista fechada das cores de emblema.

-- Legião -----------------------------------------------------------------------------------------

alter table public.groups
  add column banner_color text not null default 'porfiro'
    constraint groups_banner_color_allowed check (private.is_valid_emblem_color(banner_color)),
  add column mode text not null default 'classica'
    constraint groups_mode_allowed check (mode in ('classica', 'competitiva')),
  add column weekly_minimum smallint,
  add column mode_since date,
  add constraint groups_mode_settings check (
    (mode = 'classica' and weekly_minimum is null and mode_since is null)
    or (
      mode = 'competitiva'
      and weekly_minimum between 2 and 4
      and mode_since is not null
      and extract(isodow from mode_since) = 1
    )
  );

comment on column public.groups.banner_color is 'Cor do pano do estandarte (lista fechada das cores de emblema).';
comment on column public.groups.mode is 'classica: Coliseu semanal, sem perda. competitiva: temporadas com Louros que caem.';
comment on column public.groups.weekly_minimum is 'Treinos pontuados por semana para não perder Louros (só na competitiva).';
comment on column public.groups.mode_since is 'Segunda-feira em que a primeira temporada competitiva começa a contar.';

-- Temporadas já apuradas: cada uma vira Triunfos uma vez só.
create table private.group_seasons (
  group_id uuid not null references public.groups (id) on delete cascade,
  season_start date not null,
  settled_at timestamptz not null default now(),
  primary key (group_id, season_start)
);

comment on table private.group_seasons is 'Temporadas competitivas já apuradas (os Triunfos saíram).';

alter table private.group_seasons enable row level security;
revoke all on table private.group_seasons from public, anon, authenticated;

-- Triunfos: prêmios de temporada, guardados no perfil de quem ganhou.
create table public.trophies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  group_name text not null,
  season_start date not null,
  kind text not null constraint trophies_kind_allowed
    check (kind in ('triunfo_ouro', 'triunfo_prata', 'triunfo_bronze', 'invicto')),
  louros integer not null constraint trophies_louros_non_negative check (louros >= 0),
  awarded_at timestamptz not null default now()
);

comment on table public.trophies is
  'Triunfos de temporada competitiva. O nome da Legião é guardado para o Triunfo sobreviver a ela.';

create unique index trophies_once on public.trophies (user_id, group_id, season_start, kind);
create index trophies_by_user on public.trophies (user_id, awarded_at desc);

-- Sem políticas nem privilégios: o perfil lê pelos Triunfos pela RPC, que decide o que mostrar.
alter table public.trophies enable row level security;
revoke all on table public.trophies from public, anon, authenticated;

-- Regras da temporada ---------------------------------------------------------------------------

create function private.louros_delta(p_counts boolean, p_met boolean, p_place integer)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when not coalesce(p_counts, false) then 0
    else (case when coalesce(p_met, false) then 10 else -15 end)
      + case p_place when 1 then 15 when 2 then 10 when 3 then 5 else 0 end
  end;
$$;

comment on function private.louros_delta(boolean, boolean, integer) is
  'Louros de uma semana: +10 cumpriu o mínimo, -15 não cumpriu, +15/+10/+5 pelo pódio.';

create function private.season_start_of(p_mode_since date, p_week date)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_mode_since + (((p_week - p_mode_since) / 28) * 28);
$$;

-- Tabela de uma temporada, contando as semanas fechadas de p_season_start até p_last_week.
create function private.season_standings(p_group_id uuid, p_season_start date, p_last_week date)
returns table (
  user_id uuid,
  louros integer,
  last_delta integer,
  weeks_counted integer,
  weeks_met integer,
  podiums integer,
  season_glory integer
)
language sql
stable
set search_path = ''
as $$
  with recursive
  settings as (
    select g.weekly_minimum from public.groups as g where g.id = p_group_id
  ),
  weeks as (
    select p_season_start + 7 * i as week_start
    from generate_series(0, 3) as i
    where p_season_start + 7 * i <= p_last_week
  ),
  weekly as (
    select
      gm.user_id,
      wk.week_start,
      gm.joined_at < (wk.week_start::timestamp at time zone 'America/Sao_Paulo') as counts,
      coalesce(sum(w.points), 0)::integer as glory,
      (count(w.id) filter (where w.is_scored))::integer as scored
    from public.group_members as gm
    cross join weeks as wk
    left join public.workouts as w on w.user_id = gm.user_id and w.week_start = wk.week_start
    where gm.group_id = p_group_id
    group by gm.user_id, gm.joined_at, wk.week_start
  ),
  placed as (
    select
      wl.user_id,
      wl.week_start,
      wl.counts,
      wl.glory,
      wl.scored >= (select s.weekly_minimum from settings as s) as met,
      (case when wl.counts and wl.glory > 0 then
        rank() over (
          partition by wl.week_start
          order by case when wl.counts and wl.glory > 0 then wl.glory else -1 end desc
        )
      end)::integer as place
    from weekly as wl
  ),
  steps as (
    select
      p.user_id,
      p.counts,
      p.met,
      p.place,
      p.glory,
      private.louros_delta(p.counts, p.met, p.place) as delta,
      (row_number() over (partition by p.user_id order by p.week_start))::integer as n
    from placed as p
  ),
  running (user_id, n, louros) as (
    select s.user_id, s.n, greatest(0, s.delta) from steps as s where s.n = 1
    union all
    select s.user_id, s.n, greatest(0, r.louros + s.delta)
    from running as r
    join steps as s on s.user_id = r.user_id and s.n = r.n + 1
  )
  select
    gm.user_id,
    coalesce((select r.louros from running as r where r.user_id = gm.user_id order by r.n desc limit 1), 0),
    coalesce((select s.delta from steps as s where s.user_id = gm.user_id order by s.n desc limit 1), 0),
    (select count(*) from steps as s where s.user_id = gm.user_id and s.counts)::integer,
    (select count(*) from steps as s where s.user_id = gm.user_id and s.counts and s.met)::integer,
    (select count(*) from steps as s where s.user_id = gm.user_id and s.counts and s.place <= 3)::integer,
    coalesce((select sum(s.glory) from steps as s where s.user_id = gm.user_id and s.counts), 0)::integer
  from public.group_members as gm
  where gm.group_id = p_group_id;
$$;

comment on function private.season_standings(uuid, date, date) is
  'Louros acumulados semana a semana (nunca abaixo de zero) de cada membro numa temporada.';

-- RPCs ------------------------------------------------------------------------------------------

-- Fundar Legião agora escolhe também a cor do estandarte e o modo.
drop function public.create_group(text, text);

create function public.create_group(
  p_name text,
  p_emblem text,
  p_banner_color text default 'porfiro',
  p_mode text default 'classica',
  p_weekly_minimum integer default null
)
returns table (
  group_id uuid,
  name text,
  emblem text,
  banner_color text,
  mode text,
  weekly_minimum integer,
  mode_since date,
  invite_code text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_name text;
  v_group_id uuid;
  v_since date;
  v_code text;
  v_expires_at timestamptz;
begin
  if char_length(p_name) <= 80 then
    v_name := normalize(btrim(p_name), nfc);
  end if;
  if not private.is_valid_group_name(v_name) then
    raise exception 'invalid_group_name' using errcode = 'P0001';
  end if;
  if not private.is_valid_emblem(p_emblem) then
    raise exception 'invalid_emblem' using errcode = 'P0001';
  end if;
  if not private.is_valid_emblem_color(p_banner_color) then
    raise exception 'invalid_emblem_color' using errcode = 'P0001';
  end if;
  if p_mode is null or p_mode not in ('classica', 'competitiva') then
    raise exception 'invalid_group_mode' using errcode = 'P0001';
  end if;
  if (p_mode = 'competitiva') <> (p_weekly_minimum is not null)
    or (p_weekly_minimum is not null and p_weekly_minimum not between 2 and 4) then
    raise exception 'invalid_weekly_minimum' using errcode = 'P0001';
  end if;

  -- Serializa as operações de Legião do usuário: o limite de 10 não é burlável em paralelo.
  perform 1 from public.profiles as p where p.id = v_user_id for update;

  if (select count(*) from public.group_members as gm where gm.user_id = v_user_id) >= 10 then
    raise exception 'group_limit_reached' using errcode = 'P0001';
  end if;

  -- Fundar e sair em sequência não pode virar spam: no máximo 10 fundações em 24 horas.
  if private.recent_actions(v_user_id, null, 'group.created', interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  -- A primeira temporada começa na segunda seguinte: ninguém entra numa semana já andando.
  if p_mode = 'competitiva' then
    v_since := private.week_start(now()) + 7;
  end if;

  insert into public.groups as g (name, emblem, banner_color, mode, weekly_minimum, mode_since)
  values (v_name, p_emblem, p_banner_color, p_mode, p_weekly_minimum, v_since)
  returning g.id into v_group_id;
  insert into public.group_members (group_id, user_id, role) values (v_group_id, v_user_id, 'owner');
  perform private.audit(v_user_id, 'group.created', v_group_id);

  select issued.code, issued.expires_at into v_code, v_expires_at
  from private.issue_invite(v_group_id, v_user_id) as issued;

  return query
    select v_group_id, v_name, p_emblem, p_banner_color, p_mode, p_weekly_minimum, v_since, v_code, v_expires_at;
end;
$$;

-- O fundador troca o estandarte e o modo. O mínimo fica travado enquanto a Legião for competitiva:
-- mudá-lo no meio da temporada reescreveria as semanas já disputadas.
create function public.update_group(
  p_group_id uuid,
  p_emblem text,
  p_banner_color text,
  p_mode text,
  p_weekly_minimum integer default null
)
returns table (
  group_id uuid,
  emblem text,
  banner_color text,
  mode text,
  weekly_minimum integer,
  mode_since date
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_group public.groups;
  v_minimum smallint;
  v_since date;
begin
  if not exists (
    select 1 from public.group_members as gm
    where gm.group_id = p_group_id and gm.user_id = v_user_id and gm.role = 'owner'
  ) then
    raise exception 'not_group_owner' using errcode = '42501';
  end if;
  if not private.is_valid_emblem(p_emblem) then
    raise exception 'invalid_emblem' using errcode = 'P0001';
  end if;
  if not private.is_valid_emblem_color(p_banner_color) then
    raise exception 'invalid_emblem_color' using errcode = 'P0001';
  end if;
  if p_mode is null or p_mode not in ('classica', 'competitiva') then
    raise exception 'invalid_group_mode' using errcode = 'P0001';
  end if;
  if (p_mode = 'competitiva') <> (p_weekly_minimum is not null)
    or (p_weekly_minimum is not null and p_weekly_minimum not between 2 and 4) then
    raise exception 'invalid_weekly_minimum' using errcode = 'P0001';
  end if;

  select g.* into v_group from public.groups as g where g.id = p_group_id for update;

  if private.recent_actions(v_user_id, p_group_id, 'group.updated', interval '1 hour') >= 20 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  if p_mode = 'competitiva' and v_group.mode = 'competitiva' then
    if p_weekly_minimum <> v_group.weekly_minimum then
      raise exception 'minimum_locked' using errcode = 'P0001';
    end if;
    v_minimum := v_group.weekly_minimum;
    v_since := v_group.mode_since;
  elsif p_mode = 'competitiva' then
    v_minimum := p_weekly_minimum;
    v_since := private.week_start(now()) + 7;
  end if;

  update public.groups as g
  set emblem = p_emblem, banner_color = p_banner_color, mode = p_mode, weekly_minimum = v_minimum, mode_since = v_since
  where g.id = p_group_id;
  perform private.audit(v_user_id, 'group.updated', p_group_id);

  return query select p_group_id, p_emblem, p_banner_color, p_mode, v_minimum::integer, v_since;
end;
$$;

-- As Legiões da pessoa, agora com estandarte e modo.
drop function public.my_groups();

create function public.my_groups()
returns table (
  group_id uuid,
  name text,
  emblem text,
  banner_color text,
  mode text,
  weekly_minimum integer,
  mode_since date,
  role text,
  member_count integer,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
begin
  return query
    select
      g.id,
      g.name,
      g.emblem,
      g.banner_color,
      g.mode,
      g.weekly_minimum::integer,
      g.mode_since,
      mine.role,
      (select count(*)::integer from public.group_members as gm where gm.group_id = g.id),
      mine.joined_at
    from public.group_members as mine
    join public.groups as g on g.id = mine.group_id
    where mine.user_id = v_user_id
    order by mine.joined_at, g.id;
end;
$$;

-- A prévia do convite mostra o estandarte e o modo antes de a pessoa entrar.
drop function public.preview_invite(text);

create function public.preview_invite(p_code text)
returns table (
  status text,
  group_name text,
  group_emblem text,
  banner_color text,
  mode text,
  weekly_minimum integer,
  member_count integer,
  is_member boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_code constant text := private.normalize_invite_code(p_code);
  v_group public.groups;
begin
  perform 1 from public.profiles as p where p.id = v_user_id for update;

  if private.join_blocked(v_user_id) then
    return query select 'rate_limited'::text, null::text, null::text, null::text, null::text, null::integer, null::integer, null::boolean;
    return;
  end if;

  select g.* into v_group
  from private.group_invites as gi
  join public.groups as g on g.id = gi.group_id
  where gi.code = v_code and gi.revoked_at is null and gi.expires_at > now();

  if not found then
    perform private.record_invalid_join_attempt(v_user_id);
    return query select 'invalid'::text, null::text, null::text, null::text, null::text, null::integer, null::integer, null::boolean;
    return;
  end if;

  return query
    select
      'ok'::text,
      v_group.name,
      v_group.emblem,
      v_group.banner_color,
      v_group.mode,
      v_group.weekly_minimum::integer,
      (select count(*)::integer from public.group_members as gm where gm.group_id = v_group.id),
      exists (select 1 from public.group_members as gm where gm.group_id = v_group.id and gm.user_id = v_user_id);
end;
$$;

-- Tabela da temporada competitiva. p_season_offset: 0 é a temporada corrente, -1 a anterior.
-- Só semanas fechadas mexem nos Louros; da semana corrente vem quantos treinos pontuados cada um
-- já tem, para mostrar quem ainda precisa treinar para não perder Louros.
create function public.group_season_table(p_group_id uuid, p_season_offset integer default 0)
returns table (
  user_id uuid,
  display_name text,
  emblem text,
  emblem_color text,
  role text,
  louros integer,
  last_delta integer,
  weeks_counted integer,
  weeks_met integer,
  podiums integer,
  season_glory integer,
  week_scored integer,
  place integer,
  is_me boolean,
  season_start date,
  season_week integer,
  weekly_minimum integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_week constant date := private.week_start(now());
  v_group public.groups;
  v_season date;
  v_season_week integer;
  v_last_week date;
begin
  if p_season_offset is null or p_season_offset not in (0, -1) then
    raise exception 'invalid_season_offset' using errcode = 'P0001';
  end if;
  if not private.is_group_member(p_group_id) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  select g.* into v_group from public.groups as g where g.id = p_group_id;
  if v_group.mode <> 'competitiva' then
    raise exception 'not_competitive' using errcode = 'P0001';
  end if;

  if v_week < v_group.mode_since then
    -- Ainda não começou: a tabela da primeira temporada aparece zerada, com a semana 0.
    if p_season_offset = -1 then
      return;
    end if;
    v_season := v_group.mode_since;
    v_season_week := 0;
  else
    v_season := private.season_start_of(v_group.mode_since, v_week) + 28 * p_season_offset;
    if v_season < v_group.mode_since then
      return;
    end if;
    v_season_week := case when p_season_offset = 0 then ((v_week - v_season) / 7) + 1 else 4 end;
  end if;
  v_last_week := least(v_season + 21, v_week - 7);

  return query
    select
      st.user_id,
      p.display_name,
      p.emblem,
      p.emblem_color,
      gm.role,
      st.louros,
      st.last_delta,
      st.weeks_counted,
      st.weeks_met,
      st.podiums,
      st.season_glory,
      case when p_season_offset = 0 then (
        select (count(*) filter (where w.is_scored))::integer
        from public.workouts as w
        where w.user_id = st.user_id and w.week_start = v_week
      ) else 0 end,
      (rank() over (order by st.louros desc, st.season_glory desc))::integer,
      st.user_id = v_user_id,
      v_season,
      v_season_week,
      v_group.weekly_minimum::integer
    from private.season_standings(p_group_id, v_season, v_last_week) as st
    join public.profiles as p on p.id = st.user_id
    join public.group_members as gm on gm.group_id = p_group_id and gm.user_id = st.user_id
    order by st.louros desc, st.season_glory desc, p.display_name;
end;
$$;

-- Apura as temporadas encerradas e entrega os Triunfos. Qualquer membro pode chamar: o resultado
-- sai dos treinos e é o mesmo para todos, e cada temporada é apurada uma vez só. Devolve os
-- Triunfos que a própria pessoa ganhou nesta chamada, para a cerimônia.
create function public.settle_group_seasons(p_group_id uuid)
returns table (kind text, group_name text, season_start date, louros integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_week constant date := private.week_start(now());
  v_group public.groups;
  v_season date;
  v_new uuid[] := '{}';
  v_ids uuid[];
begin
  if not private.is_group_member(p_group_id) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  -- Uma apuração por vez em cada Legião.
  select g.* into v_group from public.groups as g where g.id = p_group_id for update;
  if v_group.mode <> 'competitiva' then
    return;
  end if;

  v_season := v_group.mode_since;
  while v_season + 28 <= v_week loop
    if not exists (
      select 1 from private.group_seasons as gs where gs.group_id = p_group_id and gs.season_start = v_season
    ) then
      with awarded as (
        insert into public.trophies (user_id, group_id, group_name, season_start, kind, louros)
        select
          st.user_id,
          p_group_id,
          v_group.name,
          v_season,
          case st.place when 1 then 'triunfo_ouro' when 2 then 'triunfo_prata' else 'triunfo_bronze' end,
          st.louros
        from (
          select s.user_id, s.louros, rank() over (order by s.louros desc, s.season_glory desc) as place
          from private.season_standings(p_group_id, v_season, v_season + 21) as s
          where s.louros > 0
        ) as st
        where st.place <= 3
        on conflict do nothing
        returning id
      )
      select coalesce(array_agg(a.id), '{}') into v_ids from awarded as a;
      v_new := v_new || v_ids;

      with awarded as (
        insert into public.trophies (user_id, group_id, group_name, season_start, kind, louros)
        select s.user_id, p_group_id, v_group.name, v_season, 'invicto', s.louros
        from private.season_standings(p_group_id, v_season, v_season + 21) as s
        where s.weeks_counted = 4 and s.weeks_met = 4
        on conflict do nothing
        returning id
      )
      select coalesce(array_agg(a.id), '{}') into v_ids from awarded as a;
      v_new := v_new || v_ids;

      insert into private.group_seasons (group_id, season_start) values (p_group_id, v_season);
    end if;
    v_season := v_season + 28;
  end loop;

  -- Só o que saiu nesta apuração, e só o da própria pessoa.
  return query
    select t.kind, t.group_name, t.season_start, t.louros
    from public.trophies as t
    where t.id = any (v_new) and t.user_id = v_user_id
    order by t.season_start, t.kind;
end;
$$;

-- Triunfos de um perfil: o próprio (p_user_id nulo) ou de quem divide uma Legião com a pessoa.
-- O nome de uma Legião só aparece para quem é membro dela: Triunfo não revela onde mais a pessoa está.
create function public.profile_trophies(p_user_id uuid default null)
returns table (kind text, group_name text, season_start date, louros integer, awarded_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_target constant uuid := coalesce(p_user_id, v_user_id);
begin
  if v_target <> v_user_id and not private.shares_group_with(v_target) then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;

  return query
    select
      t.kind,
      case when v_target = v_user_id or private.is_group_member(t.group_id) then t.group_name end,
      t.season_start,
      t.louros,
      t.awarded_at
    from public.trophies as t
    where t.user_id = v_target
    order by t.awarded_at desc, t.season_start desc, t.kind;
end;
$$;

-- Privilégios ----------------------------------------------------------------------------------

revoke all on function private.louros_delta(boolean, boolean, integer) from public;
revoke all on function private.season_start_of(date, date) from public;
revoke all on function private.season_standings(uuid, date, date) from public;

revoke all on function public.create_group(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.update_group(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.my_groups() from public, anon, authenticated;
revoke all on function public.preview_invite(text) from public, anon, authenticated;
revoke all on function public.group_season_table(uuid, integer) from public, anon, authenticated;
revoke all on function public.settle_group_seasons(uuid) from public, anon, authenticated;
revoke all on function public.profile_trophies(uuid) from public, anon, authenticated;

grant execute on function public.create_group(text, text, text, text, integer) to authenticated;
grant execute on function public.update_group(uuid, text, text, text, integer) to authenticated;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.preview_invite(text) to authenticated;
grant execute on function public.group_season_table(uuid, integer) to authenticated;
grant execute on function public.settle_group_seasons(uuid) to authenticated;
grant execute on function public.profile_trophies(uuid) to authenticated;
