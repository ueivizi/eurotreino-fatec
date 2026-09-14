-- EuroTreino · treinos, pontuação e Arena
--
-- RF006 registrar treino · RF007 pontuar no servidor · RF008 Arena semanal ·
-- RF010 rank e progresso · NF007 registro idempotente · NF010 o app não grava pontos.
--
-- Pontuação v1 (validar no piloto de 14/11): +10 presença · +1 a cada 10 min (máx. +6) ·
-- intensidade leve +0 / moderado +2 / intenso +4 · +10 no 3º treino pontuado da semana ·
-- no máximo 2 treinos pontuados por dia · lançamento até 48 h depois, nunca no futuro.

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_request_id uuid not null,
  workout_type text not null references public.workout_types (id),
  duration_min smallint not null constraint workouts_duration_range check (duration_min between 1 and 300),
  intensity text not null constraint workouts_intensity_allowed check (intensity in ('leve', 'moderado', 'intenso')),
  performed_at timestamptz not null,
  logged_at timestamptz not null default now(),
  local_date date not null,
  week_start date not null,
  is_scored boolean not null,
  presence_points smallint not null constraint workouts_presence_points_allowed check (presence_points in (0, 10)),
  duration_points smallint not null constraint workouts_duration_points_range check (duration_points between 0 and 6),
  intensity_points smallint not null constraint workouts_intensity_points_allowed check (intensity_points in (0, 2, 4)),
  bonus_points smallint not null constraint workouts_bonus_points_allowed check (bonus_points in (0, 10)),
  points smallint generated always as (presence_points + duration_points + intensity_points + bonus_points) stored,
  scoring_version smallint not null constraint workouts_scoring_version_positive check (scoring_version > 0),
  constraint workouts_client_request_unique unique (user_id, client_request_id),
  constraint workouts_performed_before_logged check (performed_at <= logged_at),
  constraint workouts_logged_within_window check (logged_at - performed_at <= interval '48 hours'),
  constraint workouts_unscored_without_points check (
    is_scored or (presence_points = 0 and duration_points = 0 and intensity_points = 0 and bonus_points = 0)
  )
);

comment on table public.workouts is 'Treinos registrados. Gravados só por log_workout; cada usuário lê apenas os próprios (RF009).';
comment on column public.workouts.client_request_id is 'Identificador gerado pelo app para cada registro; reenvios com o mesmo valor não pontuam de novo (NF007).';
comment on column public.workouts.duration_min is 'Duração informada, de 1 a 300 minutos.';
comment on column public.workouts.intensity is 'Intensidade informada: leve, moderado ou intenso.';
comment on column public.workouts.performed_at is 'Quando o treino aconteceu (até 48 h antes do registro).';
comment on column public.workouts.logged_at is 'Quando o treino foi registrado no servidor.';
comment on column public.workouts.local_date is 'Dia do treino em America/Sao_Paulo (teto de 2 pontuados por dia).';
comment on column public.workouts.week_start is 'Segunda-feira da semana da Arena em que o treino conta.';
comment on column public.workouts.is_scored is 'Falso quando o treino passou do teto diário e não rendeu Glória.';
comment on column public.workouts.presence_points is 'Glória por presença (+10).';
comment on column public.workouts.duration_points is 'Glória por duração (+1 a cada 10 minutos, até +6).';
comment on column public.workouts.intensity_points is 'Glória por intensidade (+0, +2 ou +4).';
comment on column public.workouts.bonus_points is 'Bônus de constância (+10 no 3º treino pontuado da semana).';
comment on column public.workouts.points is 'Glória total do treino (soma dos componentes).';
comment on column public.workouts.scoring_version is 'Versão da regra de pontuação aplicada.';

create index workouts_user_week_idx on public.workouts (user_id, week_start);
create index workouts_user_logged_idx on public.workouts (user_id, logged_at desc);
create index workouts_workout_type_idx on public.workouts (workout_type);

-- Componentes da Glória de um treino pontuado, pela regra v1.
create function private.workout_points_v1(p_duration_min integer, p_intensity text)
returns table (presence integer, duration integer, intensity integer)
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    10,
    least(p_duration_min / 10, 6),
    case p_intensity when 'leve' then 0 when 'moderado' then 2 when 'intenso' then 4 end;
$$;

-- Núcleo do registro. Recebe o usuário e o "agora" explicitamente para ser testável;
-- só é chamado por public.log_workout, que passa auth.uid() e now().
create function private.log_workout_for(
  p_user_id uuid,
  p_now timestamptz,
  p_client_request_id uuid,
  p_workout_type text,
  p_duration_min integer,
  p_intensity text,
  p_performed_at timestamptz
)
returns table (
  workout_id uuid,
  presence_points integer,
  duration_points integer,
  intensity_points integer,
  bonus_points integer,
  points integer,
  is_scored boolean,
  week_glory integer,
  total_glory integer,
  replayed boolean
)
language plpgsql
volatile
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_existing public.workouts;
  v_performed_at timestamptz;
  v_local_date date;
  v_week_start date;
  v_scored_today integer;
  v_scored_week integer;
  v_workout_id uuid;
  v_is_scored boolean;
  v_presence integer := 0;
  v_duration integer := 0;
  v_intensity integer := 0;
  v_bonus integer := 0;
  v_replayed boolean := false;
begin
  if p_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Serializa os registros do usuário: tetos e bônus não podem ser burlados com envios paralelos.
  perform 1 from public.profiles as p where p.id = p_user_id for update;
  if not found then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;

  if p_client_request_id is null then
    raise exception 'invalid_request_id' using errcode = 'P0001';
  end if;

  select w.* into v_existing
  from public.workouts as w
  where w.user_id = p_user_id and w.client_request_id = p_client_request_id;

  if found then
    -- Reenvio do mesmo registro: devolve o resultado original, sem pontuar de novo.
    if (v_existing.workout_type, v_existing.duration_min::integer, v_existing.intensity)
       is distinct from (p_workout_type, p_duration_min, p_intensity) then
      raise exception 'request_id_conflict' using errcode = 'P0001';
    end if;

    v_workout_id := v_existing.id;
    v_is_scored := v_existing.is_scored;
    v_presence := v_existing.presence_points;
    v_duration := v_existing.duration_points;
    v_intensity := v_existing.intensity_points;
    v_bonus := v_existing.bonus_points;
    v_replayed := true;
  else
    if not exists (select 1 from public.workout_types as wt where wt.id = p_workout_type and wt.is_active) then
      raise exception 'invalid_workout_type' using errcode = 'P0001';
    end if;
    if p_duration_min is null or p_duration_min not between 1 and 300 then
      raise exception 'invalid_duration' using errcode = 'P0001';
    end if;
    if p_intensity is null or p_intensity not in ('leve', 'moderado', 'intenso') then
      raise exception 'invalid_intensity' using errcode = 'P0001';
    end if;

    -- Tolerância de 5 minutos para relógio de aparelho adiantado; o instante gravado nunca é futuro.
    v_performed_at := coalesce(p_performed_at, p_now);
    if v_performed_at > p_now + interval '5 minutes' then
      raise exception 'performed_at_in_future' using errcode = 'P0001';
    end if;
    v_performed_at := least(v_performed_at, p_now);
    if v_performed_at < p_now - interval '48 hours' then
      raise exception 'performed_at_too_old' using errcode = 'P0001';
    end if;

    -- Contra spam: no máximo 20 registros por usuário em 24 horas.
    if (
      select count(*) from public.workouts as w
      where w.user_id = p_user_id and w.logged_at > p_now - interval '24 hours'
    ) >= 20 then
      raise exception 'rate_limited' using errcode = 'PT429';
    end if;

    v_local_date := private.sao_paulo_date(v_performed_at);
    v_week_start := private.week_start(v_performed_at);

    select count(*) filter (where w.local_date = v_local_date), count(*)
    into v_scored_today, v_scored_week
    from public.workouts as w
    where w.user_id = p_user_id and w.week_start = v_week_start and w.is_scored;

    -- A partir do 3º treino do dia, o registro vale só como histórico (0 de Glória).
    v_is_scored := v_scored_today < 2;

    if v_is_scored then
      select wp.presence, wp.duration, wp.intensity
      into v_presence, v_duration, v_intensity
      from private.workout_points_v1(p_duration_min, p_intensity) as wp;

      if v_scored_week = 2 then
        v_bonus := 10;
      end if;
    end if;

    insert into public.workouts as w (
      user_id, client_request_id, workout_type, duration_min, intensity, performed_at, logged_at,
      local_date, week_start, is_scored, presence_points, duration_points, intensity_points,
      bonus_points, scoring_version
    )
    values (
      p_user_id, p_client_request_id, p_workout_type, p_duration_min, p_intensity, v_performed_at, p_now,
      v_local_date, v_week_start, v_is_scored, v_presence, v_duration, v_intensity,
      v_bonus, 1
    )
    returning w.id into v_workout_id;
  end if;

  return query
    select
      v_workout_id,
      v_presence,
      v_duration,
      v_intensity,
      v_bonus,
      v_presence + v_duration + v_intensity + v_bonus,
      v_is_scored,
      (
        select coalesce(sum(w.points), 0)::integer from public.workouts as w
        where w.user_id = p_user_id and w.week_start = private.week_start(p_now)
      ),
      (select coalesce(sum(w.points), 0)::integer from public.workouts as w where w.user_id = p_user_id),
      v_replayed;
end;
$$;

-- RF006/RF007: registra um treino do usuário autenticado e devolve a Glória com a composição.
create function public.log_workout(
  p_client_request_id uuid,
  p_workout_type text,
  p_duration_min integer,
  p_intensity text,
  p_performed_at timestamptz default null
)
returns table (
  workout_id uuid,
  presence_points integer,
  duration_points integer,
  intensity_points integer,
  bonus_points integer,
  points integer,
  is_scored boolean,
  week_glory integer,
  total_glory integer,
  replayed boolean
)
language sql
security definer
set search_path = ''
as $$
  select * from private.log_workout_for(
    auth.uid(), now(), p_client_request_id, p_workout_type, p_duration_min, p_intensity, p_performed_at
  );
$$;

-- RF010: Glória acumulada e da semana, mais o último treino (para "Repetir último").
create function public.my_progress()
returns table (
  total_glory integer,
  week_glory integer,
  week_start date,
  week_scored_workouts integer,
  last_workout_type text,
  last_duration_min integer,
  last_intensity text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_week_start constant date := private.week_start(now());
begin
  return query
    select
      (select coalesce(sum(w.points), 0)::integer from public.workouts as w where w.user_id = v_user_id),
      (
        select coalesce(sum(w.points), 0)::integer from public.workouts as w
        where w.user_id = v_user_id and w.week_start = v_week_start
      ),
      v_week_start,
      (
        select count(*)::integer from public.workouts as w
        where w.user_id = v_user_id and w.week_start = v_week_start and w.is_scored
      ),
      last_workout.workout_type,
      last_workout.duration_min::integer,
      last_workout.intensity
    from (select 1) as single_row
    left join lateral (
      select w.workout_type, w.duration_min, w.intensity
      from public.workouts as w
      where w.user_id = v_user_id
      order by w.logged_at desc, w.id
      limit 1
    ) as last_workout on true;
end;
$$;

-- RF008: classificação da Legião na semana corrente (0) ou na anterior (-1).
-- Empates dividem a posição (1, 2, 2, 4); dentro do empate, ordem alfabética só para exibir.
create function public.group_weekly_ranking(p_group_id uuid, p_week_offset integer default 0)
returns table (
  user_id uuid,
  display_name text,
  emblem text,
  role text,
  week_glory integer,
  total_glory integer,
  place integer,
  is_me boolean,
  week_start date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_week_start date;
begin
  if p_week_offset is null or p_week_offset not in (0, -1) then
    raise exception 'invalid_week_offset' using errcode = 'P0001';
  end if;

  -- RF009: só membros enxergam a Arena; Legião inexistente e alheia dão o mesmo erro.
  if not exists (
    select 1 from public.group_members as gm where gm.group_id = p_group_id and gm.user_id = v_user_id
  ) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  v_week_start := private.week_start(now()) + 7 * p_week_offset;

  return query
    with standings as (
      select
        gm.user_id,
        gm.role,
        p.display_name,
        p.emblem,
        coalesce(sum(w.points) filter (where w.week_start = v_week_start), 0)::integer as week_points,
        coalesce(sum(w.points), 0)::integer as total_points
      from public.group_members as gm
      join public.profiles as p on p.id = gm.user_id
      left join public.workouts as w on w.user_id = gm.user_id
      where gm.group_id = p_group_id
      group by gm.user_id, gm.role, p.display_name, p.emblem
    )
    select
      s.user_id,
      s.display_name,
      s.emblem,
      s.role,
      s.week_points,
      s.total_points,
      (rank() over (order by s.week_points desc))::integer,
      s.user_id = v_user_id,
      v_week_start
    from standings as s
    order by s.week_points desc, s.display_name, s.user_id;
end;
$$;

-- Privilégios ---------------------------------------------------------------------------------

revoke all on table public.workouts from anon, authenticated;
grant select on table public.workouts to authenticated;

alter table public.workouts enable row level security;

create policy workouts_select_own on public.workouts
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on function private.workout_points_v1(integer, text) from public;
revoke all on function private.log_workout_for(uuid, timestamptz, uuid, text, integer, text, timestamptz) from public;

revoke all on function public.log_workout(uuid, text, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function public.my_progress() from public, anon, authenticated;
revoke all on function public.group_weekly_ranking(uuid, integer) from public, anon, authenticated;
grant execute on function public.log_workout(uuid, text, integer, text, timestamptz) to authenticated;
grant execute on function public.my_progress() to authenticated;
grant execute on function public.group_weekly_ranking(uuid, integer) to authenticated;
