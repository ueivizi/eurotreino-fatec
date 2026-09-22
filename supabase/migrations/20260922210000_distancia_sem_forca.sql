-- EuroTreino · a distância sai da musculação e do funcional
--
-- A migração de algumas horas antes (20260922180000) liberou distância em toda modalidade, para
-- resolver o funcional e o esporte. Foi longe demais: no aparelho, quem faz musculação passou a
-- ver um campo de distância que não quer dizer nada -- ninguém percorre quilômetro levantando
-- peso -- e a tela de registro ficou poluída.
--
-- Regra final: distância vale na resistência (corrida, caminhada, bike, natação) e na família
-- "outro" (esporte, yoga, outro); **não vale na força** (musculação, funcional). Séries e carga
-- continuam só na força. Ritmo e velocidade, só na resistência, como já estava.
--
-- Nada mais muda nesta função: é a de 20260922180000 com o bloco da distância apertado.

drop function private.log_workout_for(uuid, timestamptz, uuid, text, integer, text, timestamptz, integer, integer, numeric, text);

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

    -- Distância não existe na força: ninguém percorre quilômetro levantando peso, e o campo só
    -- polui a tela de quem faz musculação ou funcional.
    if p_distance_m is not null then
      if v_module = 'forca' then
        raise exception 'distance_not_allowed' using errcode = 'P0001';
      end if;
      if p_distance_m not between 10 and 200000 then
        raise exception 'invalid_distance' using errcode = 'P0001';
      end if;
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

revoke all on function private.log_workout_for(uuid, timestamptz, uuid, text, integer, text, timestamptz, integer, integer, numeric, text) from public;
