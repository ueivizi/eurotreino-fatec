-- EuroTreino · medidas do relógio (frequência cardíaca e pace), com consentimento
--
-- ATENÇÃO, e isto vale para qualquer mudança futura nesta parte:
-- frequência cardíaca é **dado pessoal sensível de saúde** (LGPD, art. 5º, II). Diferente do resto
-- do app, ela só pode ser tratada com consentimento específico e destacado (art. 11, I) — não serve
-- o "aceito os termos" genérico. Por isso:
--
--   1. o campo só é aceito de quem ligou o consentimento, gravado com data e hora;
--   2. desligar o consentimento apaga na hora todas as medidas já guardadas;
--   3. a medida nunca sai para a Legião: não entra na Arena, no perfil de membro nem na partilha;
--   4. excluir a conta leva tudo junto, como o resto (cascade).
--
-- Pace não é dado de saúde, mas anda junto da frequência cardíaca na mesma tela e segue a mesma
-- porta: sem consentimento, nenhum dos dois é aceito.

alter table public.profiles
  add column health_consent_at timestamptz;

comment on column public.profiles.health_consent_at is
  'Quando a pessoa consentiu, de forma específica, em registrar medidas de saúde (LGPD art. 11, I). Nulo = sem consentimento.';

alter table public.workouts
  add column avg_heart_rate smallint
    constraint workouts_avg_hr_range check (avg_heart_rate is null or avg_heart_rate between 30 and 240),
  add column max_heart_rate smallint
    constraint workouts_max_hr_range check (max_heart_rate is null or max_heart_rate between 30 and 240),
  add constraint workouts_hr_order check (
    avg_heart_rate is null or max_heart_rate is null or avg_heart_rate <= max_heart_rate
  );

comment on column public.workouts.avg_heart_rate is 'Frequência cardíaca média informada pela pessoa. Dado sensível: só com consentimento.';
comment on column public.workouts.max_heart_rate is 'Frequência cardíaca máxima informada pela pessoa. Dado sensível: só com consentimento.';

-- Liga ou desliga o consentimento. Desligar apaga o que já foi guardado, na mesma transação:
-- retirar o consentimento sem apagar o dado seria consentimento de fachada.
create function public.set_health_consent(p_granted boolean)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
  v_at timestamptz;
begin
  if p_granted is null then
    raise exception 'invalid_consent' using errcode = 'P0001';
  end if;

  if p_granted then
    update public.profiles as p
    set health_consent_at = coalesce(p.health_consent_at, now())
    where p.id = v_user_id
    returning p.health_consent_at into v_at;
    return v_at;
  end if;

  update public.workouts as w
  set avg_heart_rate = null, max_heart_rate = null
  where w.user_id = v_user_id and (w.avg_heart_rate is not null or w.max_heart_rate is not null);

  update public.profiles as p set health_consent_at = null where p.id = v_user_id;
  perform private.audit(v_user_id, 'health.consent_revoked', null);
  return null;
end;
$$;

-- log_workout ganha as medidas; sem consentimento, elas são recusadas, não ignoradas em silêncio.
drop function public.log_workout(uuid, text, integer, text, timestamptz, integer, integer, numeric);

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
  p_max_heart_rate integer default null
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
    p_distance_m, p_sets_count, p_load_kg
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

revoke all on function public.log_workout(uuid, text, integer, text, timestamptz, integer, integer, numeric, integer, integer) from public, anon, authenticated;
revoke all on function public.set_health_consent(boolean) from public, anon, authenticated;
grant execute on function public.log_workout(uuid, text, integer, text, timestamptz, integer, integer, numeric, integer, integer) to authenticated;
grant execute on function public.set_health_consent(boolean) to authenticated;
