-- EuroTreino · os Anais dizem qual treino ainda dá para corrigir
--
-- `edit_workout` só aceita treino da semana corrente (o Coliseu das semanas passadas já foi
-- disputado). Quem sabe onde a semana começa é o banco: segunda-feira em São Paulo, a mesma regra
-- que decide a que semana o treino pertence. O app não vai repetir essa conta -- ele pergunta.
--
-- Sem isto, a tela teria de adivinhar o fuso de São Paulo no relógio do aparelho, ou oferecer a
-- correção para todo treino e deixar a pessoa descobrir o "não" depois de preencher o formulário.
--
-- `can_edit` é a foto do momento da consulta: quem deixar o app aberto na virada da semana ainda vê
-- o botão, e aí o servidor recusa com a mensagem de semana fechada. A regra continua sendo dele.

drop function public.my_workouts(date);

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
  note text,
  can_edit boolean
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
  v_week constant date := private.week_start(now());
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
      w.note,
      w.week_start = v_week
    from public.workouts as w
    join public.workout_types as wt on wt.id = w.workout_type
    where w.user_id = v_user_id
      and w.local_date >= v_start
      and w.local_date < (v_start + interval '1 month')::date
    order by w.performed_at desc, w.id;
end;
$$;

comment on function public.my_workouts(date) is
  'Treinos da pessoa num mês (o corrente, se nenhum for pedido), do mais recente para o mais antigo, com can_edit dizendo quais ainda estão na semana corrente. Só do próprio dono.';

revoke all on function public.my_workouts(date) from public, anon, authenticated;
grant execute on function public.my_workouts(date) to authenticated;
