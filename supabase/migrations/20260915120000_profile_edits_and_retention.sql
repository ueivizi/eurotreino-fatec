-- EuroTreino · edição de perfil, contagem de treinos e retenção de dados de segurança
--
-- RF002 editar nome e emblema (com limite contra abuso) · RF010 total de treinos no Perfil ·
-- NF013/LGPD: registros de segurança guardados só pelo tempo necessário.

-- RF002: cria ou atualiza o próprio perfil. Edições contam no limite de 10 por 24 horas;
-- salvar sem mudar nada não grava nem conta.
create or replace function public.complete_profile(p_display_name text, p_emblem text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := auth.uid();
  v_display_name text;
  v_current public.profiles;
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  -- Entradas enormes são recusadas antes da normalização Unicode, cujo custo cresce com o tamanho.
  if char_length(p_display_name) <= 64 then
    v_display_name := normalize(btrim(p_display_name), nfc);
  end if;
  if not private.is_valid_display_name(v_display_name) then
    raise exception 'invalid_display_name' using errcode = 'P0001';
  end if;
  if not private.is_valid_emblem(p_emblem) then
    raise exception 'invalid_emblem' using errcode = 'P0001';
  end if;

  -- Serializa as edições do usuário: o limite não é burlável com envios paralelos.
  select p.* into v_current from public.profiles as p where p.id = v_user_id for update;

  if found then
    if v_current.display_name = v_display_name and v_current.emblem = p_emblem then
      return v_current;
    end if;
    if private.recent_actions(v_user_id, null, 'profile.updated', interval '24 hours') >= 10 then
      raise exception 'rate_limited' using errcode = 'PT429';
    end if;

    update public.profiles as p
    set display_name = v_display_name,
        emblem = p_emblem,
        updated_at = now()
    where p.id = v_user_id
    returning p.* into v_profile;

    perform private.audit(v_user_id, 'profile.updated', null);
    return v_profile;
  end if;

  -- Primeiro acesso. Em corrida entre duas abas, a segunda vira uma atualização comum.
  insert into public.profiles as p (id, display_name, emblem)
  values (v_user_id, v_display_name, p_emblem)
  on conflict (id) do update
    set display_name = excluded.display_name,
        emblem = excluded.emblem,
        updated_at = now()
  returning p.* into v_profile;

  return v_profile;
end;
$$;

-- RF010: o progresso passa a trazer o total de treinos registrados (pontuados ou não).
drop function public.my_progress();

create function public.my_progress()
returns table (
  total_glory integer,
  week_glory integer,
  week_start date,
  week_scored_workouts integer,
  total_workouts integer,
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
      (select count(*)::integer from public.workouts as w where w.user_id = v_user_id),
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

revoke all on function public.my_progress() from public, anon, authenticated;
grant execute on function public.my_progress() to authenticated;

-- Retenção: tentativas de código inválido valem 1 dia; eventos de segurança, 90 dias.
-- Depois disso não servem aos limites nem à investigação de abuso e são apagados.
create function private.prune_expired_security_data()
returns void
language sql
volatile
set search_path = ''
as $$
  delete from private.join_attempts as ja where ja.attempted_at < now() - interval '1 day';
  delete from private.audit_log as al where al.occurred_at < now() - interval '90 days';
$$;

comment on function private.prune_expired_security_data() is 'Apaga tentativas de convite com mais de 1 dia e eventos de auditoria com mais de 90 dias (LGPD: minimização).';

revoke all on function private.prune_expired_security_data() from public;

-- Agenda a limpeza diária onde o pg_cron existe (projeto hospedado). No Postgres em memória
-- dos testes ele não existe: a função é testada diretamente.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('eurotreino-retencao-seguranca', '17 6 * * *', 'select private.prune_expired_security_data()');
  end if;
end;
$$;
