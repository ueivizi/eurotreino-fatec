-- EuroTreino · Anais: o histórico de treinos da própria pessoa (RF012)
--
-- O app já sabia somar Glória, mas não sabia mostrar o que foi feito. Os Anais são a lista do que
-- aconteceu, mês a mês: cada treino com a hora, a composição da Glória e os detalhes da modalidade.
--
-- Duas funções, porque são duas perguntas diferentes:
--   my_workout_months() — que meses têm treino, com o total de cada um (o cabeçalho e a navegação);
--   my_workouts(mês)    — os treinos daquele mês, do mais recente para o mais antigo.
--
-- Mês é sempre o mês **local** de São Paulo, o mesmo que decide a que dia o treino pertence na
-- Arena; usar UTC faria o treino das 22h de dia 31 aparecer no mês seguinte.
--
-- Isto é leitura do próprio histórico e de mais ninguém: `private.require_profile()` fixa o dono, e
-- a Legião continua vendo só a Glória da semana. A frequência cardíaca sai porque é da pessoa que
-- está pedindo -- e ela só existe se a própria tiver consentido em registrá-la.

create index workouts_user_local_date_idx on public.workouts (user_id, local_date desc);

create function public.my_workout_months()
returns table (
  month date,
  workouts_count integer,
  glory integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    date_trunc('month', w.local_date)::date as month,
    count(*)::integer,
    coalesce(sum(w.points), 0)::integer
  from public.workouts as w
  where w.user_id = private.require_profile()
  group by date_trunc('month', w.local_date)
  order by month desc;
$$;

comment on function public.my_workout_months() is
  'Meses com treino da pessoa, com quantos treinos e quanta Glória em cada um. Só do próprio dono.';

create function public.my_workouts(p_month date default null)
returns table (
  workout_id uuid,
  workout_type text,
  module text,
  duration_min integer,
  intensity text,
  performed_at timestamptz,
  local_date date,
  is_scored boolean,
  presence_points integer,
  duration_points integer,
  intensity_points integer,
  bonus_points integer,
  points integer,
  distance_m integer,
  sets_count integer,
  load_kg numeric,
  avg_heart_rate integer,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  -- Sem mês pedido, vale o mês corrente em São Paulo.
  v_start constant date := date_trunc('month', coalesce(p_month, private.sao_paulo_date(now())))::date;
begin
  return query
    select
      w.id,
      w.workout_type,
      wt.module,
      w.duration_min::integer,
      w.intensity,
      w.performed_at,
      w.local_date,
      w.is_scored,
      w.presence_points::integer,
      w.duration_points::integer,
      w.intensity_points::integer,
      w.bonus_points::integer,
      w.points::integer,
      w.distance_m,
      w.sets_count::integer,
      w.load_kg,
      w.avg_heart_rate::integer,
      w.note
    from public.workouts as w
    join public.workout_types as wt on wt.id = w.workout_type
    where w.user_id = v_user_id
      and w.local_date >= v_start
      and w.local_date < (v_start + interval '1 month')::date
    order by w.performed_at desc, w.id;
end;
$$;

comment on function public.my_workouts(date) is
  'Treinos da pessoa num mês (o corrente, se nenhum for pedido), do mais recente para o mais antigo. Só do próprio dono.';

revoke all on function public.my_workout_months() from public, anon, authenticated;
revoke all on function public.my_workouts(date) from public, anon, authenticated;
grant execute on function public.my_workout_months() to authenticated;
grant execute on function public.my_workouts(date) to authenticated;
