-- EuroTreino · "Repetir último" com os detalhes da modalidade
--
-- O my_progress devolvia só tipo, duração e intensidade do último treino, então "Repetir último"
-- recomeçava sem distância, séries nem carga: quem testou no celular em 20/09 reparou. As colunas
-- já existem em public.workouts (20260916120000_sport_modules.sql); aqui elas passam a sair junto.
--
-- A frequência cardíaca fica **de fora de propósito**, e não é esquecimento:
--   1. ela é medida, não preferência. Repetir um treino com a frequência do treino anterior
--      gravaria uma medição que não aconteceu -- invenção de dado de saúde, não conveniência;
--   2. é dado pessoal sensível (LGPD art. 11, I; ver 20260916200000_health_metrics.sql), e o que
--      não tem uso na tela não deve sair do banco (minimização);
--   3. quem tem a medida de verdade é a importação do relógio, que já a traz do Health Connect.

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
  last_intensity text,
  last_distance_m integer,
  last_sets_count integer,
  last_load_kg numeric
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
      last_workout.load_kg
    from (select 1) as single_row
    left join lateral (
      select w.workout_type, w.duration_min, w.intensity, w.distance_m, w.sets_count, w.load_kg
      from public.workouts as w
      where w.user_id = v_user_id
      order by w.logged_at desc, w.id
      limit 1
    ) as last_workout on true;
end;
$$;

comment on function public.my_progress() is
  'Glória total e da semana, contagem de treinos e o último treino da pessoa (tipo, duração, intensidade, distância, séries e carga) para repetir o registro. Sem frequência cardíaca: medida não se repete.';

revoke all on function public.my_progress() from public, anon, authenticated;
grant execute on function public.my_progress() to authenticated;
