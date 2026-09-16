-- EuroTreino · módulos por esporte
--
-- Cada modalidade passa a aceitar detalhes próprios, todos opcionais:
--   resistência (corrida, caminhada, bike, natação) → distância, que rende ritmo e velocidade;
--   força (musculação, funcional)                   → séries e carga principal.
--
-- Os detalhes NÃO mudam a Glória. A regra v1 (presença, duração, intensidade, constância) continua
-- valendo igual para todo mundo, porque comparar 10 km de bike com 10 km de corrida na mesma Arena
-- seria injusto e a validação do piloto (14/11) é sobre a regra v1. Distância e carga servem para
-- o histórico, os recordes pessoais e a partilha.
--
-- Um treino só pode trazer os detalhes da sua família: o tipo diz qual é, e log_workout recusa o
-- resto. A tabela sozinha não consegue conferir isso (precisaria de join), então a regra mora na
-- RPC — que é a única escritora, com insert revogado para todo mundo.

alter table public.workout_types
  add column module text not null default 'outro'
  constraint workout_types_module_allowed check (module in ('resistencia', 'forca', 'outro'));

comment on column public.workout_types.module is
  'Família da modalidade: resistencia aceita distância; forca aceita séries e carga; outro não aceita detalhes.';

update public.workout_types set module = 'resistencia' where id in ('corrida', 'caminhada', 'bike', 'natacao');
update public.workout_types set module = 'forca' where id in ('musculacao', 'funcional');

-- Distância em metros: o inteiro evita o arredondamento do binário e ainda guarda 100 m de piscina.
-- Teto de 200 km, que já cobre um dia de cicloturismo e barra digitação absurda.
alter table public.workouts
  add column distance_m integer
    constraint workouts_distance_range check (distance_m is null or distance_m between 10 and 200000),
  add column sets_count smallint
    constraint workouts_sets_range check (sets_count is null or sets_count between 1 and 60),
  -- Carga da série principal, em passos de 0,5 kg (anilha mais fina de academia).
  add column load_kg numeric(5, 1)
    constraint workouts_load_range check (load_kg is null or (load_kg between 0.5 and 500 and (load_kg * 2) = floor(load_kg * 2)));

comment on column public.workouts.distance_m is 'Distância em metros (só modalidades de resistência). Não altera a Glória.';
comment on column public.workouts.sets_count is 'Número de séries (só modalidades de força). Não altera a Glória.';
comment on column public.workouts.load_kg is 'Carga da série principal, em kg e múltiplos de 0,5 (só modalidades de força).';

-- Recordes por modalidade: a consulta sempre filtra pelo dono, então o índice acompanha.
create index workouts_user_type_distance_idx
  on public.workouts (user_id, workout_type, distance_m desc)
  where distance_m is not null;

-- A assinatura de log_workout muda: recria e refaz os grants.
drop function public.log_workout(uuid, text, integer, text, timestamptz);
drop function private.log_workout_for(uuid, timestamptz, uuid, text, integer, text, timestamptz);

create function private.log_workout_for(
  p_user_id uuid,
  p_now timestamptz,
  p_client_request_id uuid,
  p_workout_type text,
  p_duration_min integer,
  p_intensity text,
  p_performed_at timestamptz,
  p_distance_m integer default null,
  p_sets_count integer default null,
  p_load_kg numeric default null
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
  replayed boolean,
  is_distance_record boolean
)
language plpgsql
volatile
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_existing public.workouts;
  v_module text;
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
  v_previous_best integer;
  v_is_record boolean := false;
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
    -- Reenvio do mesmo registro: devolve o resultado original, sem pontuar de novo. Os detalhes
    -- entram na comparação para que um reenvio "com outra distância" não passe despercebido.
    if (
      v_existing.workout_type, v_existing.duration_min::integer, v_existing.intensity,
      v_existing.distance_m, v_existing.sets_count::integer, v_existing.load_kg
    ) is distinct from (
      p_workout_type, p_duration_min, p_intensity, p_distance_m, p_sets_count, p_load_kg
    ) then
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
    select wt.module into v_module
    from public.workout_types as wt
    where wt.id = p_workout_type and wt.is_active;
    if not found then
      raise exception 'invalid_workout_type' using errcode = 'P0001';
    end if;

    if p_duration_min is null or p_duration_min not between 1 and 300 then
      raise exception 'invalid_duration' using errcode = 'P0001';
    end if;
    if p_intensity is null or p_intensity not in ('leve', 'moderado', 'intenso') then
      raise exception 'invalid_intensity' using errcode = 'P0001';
    end if;

    -- Detalhe fora da família da modalidade é erro, não silêncio: distância em musculação seria
    -- dado sem sentido no histórico e no recorde.
    if p_distance_m is not null then
      if v_module <> 'resistencia' then
        raise exception 'distance_not_allowed' using errcode = 'P0001';
      end if;
      if p_distance_m not between 10 and 200000 then
        raise exception 'invalid_distance' using errcode = 'P0001';
      end if;
    end if;

    if p_sets_count is not null or p_load_kg is not null then
      if v_module <> 'forca' then
        raise exception 'strength_not_allowed' using errcode = 'P0001';
      end if;
      if p_sets_count is not null and p_sets_count not between 1 and 60 then
        raise exception 'invalid_sets' using errcode = 'P0001';
      end if;
      if p_load_kg is not null and (p_load_kg not between 0.5 and 500 or (p_load_kg * 2) <> floor(p_load_kg * 2)) then
        raise exception 'invalid_load' using errcode = 'P0001';
      end if;
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

    -- Recorde de distância na modalidade, conferido antes de gravar o treino novo.
    if p_distance_m is not null then
      select max(w.distance_m) into v_previous_best
      from public.workouts as w
      where w.user_id = p_user_id and w.workout_type = p_workout_type and w.distance_m is not null;
      v_is_record := v_previous_best is not null and p_distance_m > v_previous_best;
    end if;

    insert into public.workouts as w (
      user_id, client_request_id, workout_type, duration_min, intensity, performed_at, logged_at,
      local_date, week_start, is_scored, presence_points, duration_points, intensity_points,
      bonus_points, scoring_version, distance_m, sets_count, load_kg
    )
    values (
      p_user_id, p_client_request_id, p_workout_type, p_duration_min, p_intensity, v_performed_at, p_now,
      v_local_date, v_week_start, v_is_scored, v_presence, v_duration, v_intensity,
      v_bonus, 1, p_distance_m, p_sets_count::smallint, p_load_kg
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
      v_replayed,
      v_is_record;
end;
$$;

-- RF006/RF007: registra um treino do usuário autenticado e devolve a Glória com a composição.
create function public.log_workout(
  p_client_request_id uuid,
  p_workout_type text,
  p_duration_min integer,
  p_intensity text,
  p_performed_at timestamptz default null,
  p_distance_m integer default null,
  p_sets_count integer default null,
  p_load_kg numeric default null
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
  replayed boolean,
  is_distance_record boolean
)
language sql
security definer
set search_path = ''
as $$
  select * from private.log_workout_for(
    auth.uid(), now(), p_client_request_id, p_workout_type, p_duration_min, p_intensity, p_performed_at,
    p_distance_m, p_sets_count, p_load_kg
  );
$$;

-- Recordes pessoais por modalidade. Só do próprio usuário: não existe recorde de outra pessoa aqui.
create function public.my_records()
returns table (
  workout_type text,
  module text,
  workouts_count integer,
  total_minutes integer,
  best_distance_m integer,
  total_distance_m bigint,
  best_pace_s_per_km integer,
  best_load_kg numeric,
  best_sets_count integer
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
      wt.id,
      wt.module,
      count(w.id)::integer,
      coalesce(sum(w.duration_min), 0)::integer,
      max(w.distance_m)::integer,
      coalesce(sum(w.distance_m), 0)::bigint,
      -- Melhor ritmo, em segundos por quilômetro. Só treinos de 1 km ou mais entram: num trecho
      -- curto qualquer pique viraria "recorde" e o número deixaria de significar alguma coisa.
      min(
        case when w.distance_m >= 1000
          then ((w.duration_min * 60000.0) / w.distance_m)::integer
        end
      ),
      max(w.load_kg),
      max(w.sets_count)::integer
    from public.workout_types as wt
    join public.workouts as w on w.workout_type = wt.id and w.user_id = v_user_id
    group by wt.id, wt.module, wt.sort_order
    order by wt.sort_order;
end;
$$;

revoke all on function private.log_workout_for(uuid, timestamptz, uuid, text, integer, text, timestamptz, integer, integer, numeric) from public;
revoke all on function public.log_workout(uuid, text, integer, text, timestamptz, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.my_records() from public, anon, authenticated;
grant execute on function public.log_workout(uuid, text, integer, text, timestamptz, integer, integer, numeric) to authenticated;
grant execute on function public.my_records() to authenticated;
