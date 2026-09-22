-- EuroTreino · distância em qualquer modalidade e um campo livre no "Outro"
--
-- Dois achados do teste com usuários (20 e 21/09):
--   1. quem faz funcional, joga bola ou registra um "outro" não conseguia guardar a distância --
--      a regra de 16/09 só aceitava distância na família resistência;
--   2. escolher "Outro" não deixava dizer o que foi o treino.
--
-- A regra antiga dizia que "distância em musculação seria dado sem sentido no histórico e no
-- recorde". O campo mostrou o contrário: distância é medida universal -- quem andou 3 km andou
-- 3 km, seja na corrida, no funcional ou no futebol --, e o funcional é família força. Então a
-- distância passa a valer em toda modalidade. Séries e carga continuam só na força, onde
-- significam alguma coisa, e o **ritmo continua só na resistência**: minutos por quilômetro de
-- musculação não querem dizer nada, e é isso que `my_records` passa a respeitar.
--
-- A nota é privada como o resto do treino: não entra na Arena, não aparece para a Legião, não vai
-- para a partilha e some junto na exclusão da conta (cascade). Só a família "outro" a aceita --
-- é lá que falta o nome da atividade. O tamanho é curto de propósito: é um rótulo ("futebol",
-- "pilates"), não um diário; campo livre grande convidaria a escrever dado de saúde que o app
-- não pediu e não sabe proteger.

alter table public.workouts
  add column note text
    constraint workouts_note_length check (note is null or length(note) between 1 and 40)
    constraint workouts_note_trimmed check (note is null or btrim(note) = note);

comment on column public.workouts.note is
  'O que foi o treino, só quando a modalidade é da família "outro". Privado: nunca sai para a Legião.';

drop function public.log_workout(uuid, text, integer, text, timestamptz, integer, integer, numeric, integer, integer);
drop function private.log_workout_for(uuid, timestamptz, uuid, text, integer, text, timestamptz, integer, integer, numeric);
drop function public.my_records();
drop function public.my_progress();

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
  p_load_kg numeric default null,
  p_note text default null
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
  v_note text;
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

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  select w.* into v_existing
  from public.workouts as w
  where w.user_id = p_user_id and w.client_request_id = p_client_request_id;

  if found then
    -- Reenvio do mesmo registro: devolve o resultado original, sem pontuar de novo. Os detalhes
    -- entram na comparação para que um reenvio "com outra distância" não passe despercebido.
    if (
      v_existing.workout_type, v_existing.duration_min::integer, v_existing.intensity,
      v_existing.distance_m, v_existing.sets_count::integer, v_existing.load_kg, v_existing.note
    ) is distinct from (
      p_workout_type, p_duration_min, p_intensity, p_distance_m, p_sets_count, p_load_kg, v_note
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

    -- Distância vale em qualquer modalidade; o limite continua sendo o da coluna.
    if p_distance_m is not null and p_distance_m not between 10 and 200000 then
      raise exception 'invalid_distance' using errcode = 'P0001';
    end if;

    -- Séries e carga seguem só na força: fora dela seriam dado sem significado.
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

    -- A nota nomeia o que a modalidade não diz: só existe na família "outro".
    if v_note is not null then
      if v_module <> 'outro' then
        raise exception 'note_not_allowed' using errcode = 'P0001';
      end if;
      if length(v_note) > 40 then
        raise exception 'invalid_note' using errcode = 'P0001';
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
      bonus_points, scoring_version, distance_m, sets_count, load_kg, note
    )
    values (
      p_user_id, p_client_request_id, p_workout_type, p_duration_min, p_intensity, v_performed_at, p_now,
      v_local_date, v_week_start, v_is_scored, v_presence, v_duration, v_intensity,
      v_bonus, 1, p_distance_m, p_sets_count::smallint, p_load_kg, v_note
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
  p_load_kg numeric default null,
  p_avg_heart_rate integer default null,
  p_max_heart_rate integer default null,
  p_note text default null
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
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := auth.uid();
  v_result record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_avg_heart_rate is not null or p_max_heart_rate is not null then
    if not exists (
      select 1 from public.profiles as p where p.id = v_user_id and p.health_consent_at is not null
    ) then
      raise exception 'health_consent_required' using errcode = 'P0001';
    end if;
    if p_avg_heart_rate is not null and p_avg_heart_rate not between 30 and 240 then
      raise exception 'invalid_heart_rate' using errcode = 'P0001';
    end if;
    if p_max_heart_rate is not null and p_max_heart_rate not between 30 and 240 then
      raise exception 'invalid_heart_rate' using errcode = 'P0001';
    end if;
    if p_avg_heart_rate is not null and p_max_heart_rate is not null and p_avg_heart_rate > p_max_heart_rate then
      raise exception 'invalid_heart_rate' using errcode = 'P0001';
    end if;
  end if;

  select * into v_result
  from private.log_workout_for(
    v_user_id, now(), p_client_request_id, p_workout_type, p_duration_min, p_intensity, p_performed_at,
    p_distance_m, p_sets_count, p_load_kg, p_note
  );

  -- As medidas entram no treino recém-criado; num reenvio, o treino já existe e nada muda.
  if not v_result.replayed and (p_avg_heart_rate is not null or p_max_heart_rate is not null) then
    update public.workouts as w
    set avg_heart_rate = p_avg_heart_rate::smallint, max_heart_rate = p_max_heart_rate::smallint
    where w.id = v_result.workout_id;
  end if;

  return query select
    v_result.workout_id, v_result.presence_points, v_result.duration_points, v_result.intensity_points,
    v_result.bonus_points, v_result.points, v_result.is_scored, v_result.week_glory, v_result.total_glory,
    v_result.replayed, v_result.is_distance_record;
end;
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
      -- E só na resistência: agora que a distância vale em qualquer modalidade, ritmo de
      -- musculação seria um número sem sentido nenhum.
      min(
        case when w.distance_m >= 1000 and wt.module = 'resistencia'
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

create function public.my_progress()
returns table (
  total_glory integer,
  week_glory integer,
  week_start date,
  week_scored_workouts integer,
  total_workouts integer,
  last_workout_type text,
  last_duration_min integer,
  last_intensity text,
  last_distance_m integer,
  last_sets_count integer,
  last_load_kg numeric,
  last_note text
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
      (select count(*)::integer from public.workouts as w where w.user_id = v_user_id),
      last_workout.workout_type,
      last_workout.duration_min::integer,
      last_workout.intensity,
      last_workout.distance_m,
      last_workout.sets_count::integer,
      last_workout.load_kg,
      last_workout.note
    from (select 1) as single_row
    left join lateral (
      select w.workout_type, w.duration_min, w.intensity, w.distance_m, w.sets_count, w.load_kg, w.note
      from public.workouts as w
      where w.user_id = v_user_id
      order by w.logged_at desc, w.id
      limit 1
    ) as last_workout on true;
end;
$$;

comment on function public.my_progress() is
  'Glória total e da semana, contagem de treinos e o último treino da pessoa (tipo, duração, intensidade, distância, séries, carga e a nota do "outro") para repetir o registro. Sem frequência cardíaca: medida não se repete.';

revoke all on function private.log_workout_for(uuid, timestamptz, uuid, text, integer, text, timestamptz, integer, integer, numeric, text) from public;
revoke all on function public.log_workout(uuid, text, integer, text, timestamptz, integer, integer, numeric, integer, integer, text) from public, anon, authenticated;
revoke all on function public.my_records() from public, anon, authenticated;
revoke all on function public.my_progress() from public, anon, authenticated;
grant execute on function public.log_workout(uuid, text, integer, text, timestamptz, integer, integer, numeric, integer, integer, text) to authenticated;
grant execute on function public.my_records() to authenticated;
grant execute on function public.my_progress() to authenticated;
