-- EuroTreino · editar um treino já registrado (RF014)
--
-- Quem erra a duração ou a intensidade hoje precisa conviver com o erro para sempre. Esta função
-- conserta o registro -- e só ele.
--
-- **Só o treino da semana corrente pode ser editado.** Semana fechada é história: mexer nela
-- mudaria o Coliseu de uma disputa que já terminou, e quem ficou em segundo lugar na segunda-feira
-- não pode descobrir na quarta que perdeu por causa de uma edição. A mensagem que o app mostra
-- diz isso com todas as letras.
--
-- O que a edição **não** mexe:
--   * o instante do treino -- mudar o horário mudaria o dia, a semana, o teto diário e o bônus de
--     constância, ou seja, reescreveria a pontuação de toda a semana;
--   * `is_scored` e o bônus de constância -- eles dependem da ordem dos treinos no dia e na semana,
--     que continua a mesma;
--   * a Honra e os recordes já concedidos: conquista dada não se tira por correção de digitação.
--
-- O que ela recalcula é só o que depende de duração e intensidade, com a mesma regra v1 de sempre.

create function public.edit_workout(
  p_workout_id uuid,
  p_workout_type text,
  p_duration_min integer,
  p_intensity text,
  p_distance_m integer default null,
  p_sets_count integer default null,
  p_load_kg numeric default null,
  p_avg_heart_rate integer default null,
  p_note text default null
)
returns table (
  workout_id uuid,
  points integer,
  is_scored boolean,
  week_glory integer,
  total_glory integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_existing public.workouts;
  v_module text;
  v_note text;
  v_presence integer := 0;
  v_duration integer := 0;
  v_intensity integer := 0;
begin
  if p_workout_id is null then
    raise exception 'invalid_workout' using errcode = 'P0001';
  end if;

  -- Treino de outra pessoa e treino inexistente dão o mesmo erro: a resposta não revela nada.
  select w.* into v_existing
  from public.workouts as w
  where w.id = p_workout_id and w.user_id = v_user_id
  for update;
  if not found then
    raise exception 'workout_not_found' using errcode = 'P0001';
  end if;

  if v_existing.week_start <> private.week_start(now()) then
    raise exception 'week_closed' using errcode = 'P0001';
  end if;

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

  -- As mesmas regras de família do registro: o que não pertence à modalidade é recusado, não ignorado.
  if p_distance_m is not null then
    if v_module = 'forca' then
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

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null then
    if v_module <> 'outro' then
      raise exception 'note_not_allowed' using errcode = 'P0001';
    end if;
    if length(v_note) > 40 then
      raise exception 'invalid_note' using errcode = 'P0001';
    end if;
  end if;

  if p_avg_heart_rate is not null then
    if not exists (
      select 1 from public.profiles as p where p.id = v_user_id and p.health_consent_at is not null
    ) then
      raise exception 'health_consent_required' using errcode = 'P0001';
    end if;
    if p_avg_heart_rate not between 30 and 240 then
      raise exception 'invalid_heart_rate' using errcode = 'P0001';
    end if;
    if v_existing.max_heart_rate is not null and p_avg_heart_rate > v_existing.max_heart_rate then
      raise exception 'invalid_heart_rate' using errcode = 'P0001';
    end if;
  end if;

  -- A Glória volta a ser calculada pela regra v1; o bônus de constância fica como estava.
  if v_existing.is_scored then
    select wp.presence, wp.duration, wp.intensity
    into v_presence, v_duration, v_intensity
    from private.workout_points_v1(p_duration_min, p_intensity) as wp;
  end if;

  update public.workouts as w
  set
    workout_type = p_workout_type,
    duration_min = p_duration_min::smallint,
    intensity = p_intensity,
    distance_m = p_distance_m,
    sets_count = p_sets_count::smallint,
    load_kg = p_load_kg,
    avg_heart_rate = p_avg_heart_rate::smallint,
    note = v_note,
    presence_points = v_presence::smallint,
    duration_points = v_duration::smallint,
    intensity_points = v_intensity::smallint
  where w.id = p_workout_id;

  return query
    select
      p_workout_id,
      (v_presence + v_duration + v_intensity + v_existing.bonus_points)::integer,
      v_existing.is_scored,
      (
        select coalesce(sum(w.points), 0)::integer from public.workouts as w
        where w.user_id = v_user_id and w.week_start = private.week_start(now())
      ),
      (select coalesce(sum(w.points), 0)::integer from public.workouts as w where w.user_id = v_user_id);
end;
$$;

comment on function public.edit_workout(uuid, text, integer, text, integer, integer, numeric, integer, text) is
  'Corrige um treino da semana corrente (RF014). Não muda o horário, o bônus de constância nem a Honra já concedida; recalcula só o que depende de duração e intensidade.';

revoke all on function public.edit_workout(uuid, text, integer, text, integer, integer, numeric, integer, text) from public, anon, authenticated;
grant execute on function public.edit_workout(uuid, text, integer, text, integer, integer, numeric, integer, text) to authenticated;
