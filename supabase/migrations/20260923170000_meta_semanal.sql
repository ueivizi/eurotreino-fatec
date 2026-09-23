-- EuroTreino · meta semanal, sequência de dias e Chama de Vesta (RF015 a RF017)
--
-- A Glória é a disputa com os amigos. O juramento é a disputa consigo mesmo: quantos dias da
-- semana a pessoa se comprometeu a treinar. **Ele não encosta na Glória nem no Coliseu** -- quem
-- treina sozinho, ou volta depois de anos parado, precisa de um placar que não dependa de estar
-- ganhando de ninguém. Há teste provando que a pontuação não muda.
--
-- Três medidas, que são três perguntas diferentes:
--   * a meta da semana corrente e quantos dias dela já foram cumpridos (RF015, RF016);
--   * a sequência de dias seguidos treinados (RF017);
--   * a Chama de Vesta: semanas seguidas em que o juramento foi cumprido.
--
-- **A meta conta dias, não registros.** De 1 a 7 é a faixa da própria semana, e quem registra dois
-- treinos numa terça treinou numa terça só. Contar registros deixaria a meta virar um jogo de
-- lançar treino, que é exatamente o contrário do que ela existe para medir.
--
-- Cada juramento fica gravado na semana em que foi feito, e a meta em vigor numa semana é a do
-- último juramento feito até ela. Assim mudar a meta hoje muda a semana corrente e as próximas --
-- nunca as passadas, que já foram vividas com outra promessa. Zero é "sem juramento": quem quer
-- parar de se cobrar não precisa apagar nada, e a semana sem juramento simplesmente não alimenta
-- a Chama.

create table public.weekly_goals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Segunda-feira (America/Sao_Paulo) da semana em que o juramento foi feito.
  week_start date not null,
  target smallint not null constraint weekly_goals_target_range check (target between 0 and 7),
  set_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

comment on table public.weekly_goals is
  'Juramento da semana: quantos dias a pessoa se comprometeu a treinar. Meta pessoal, fora da Glória e do Coliseu.';
comment on column public.weekly_goals.target is
  'De 1 a 7 dias; 0 é "sem juramento", que não alimenta a Chama de Vesta.';

alter table public.weekly_goals enable row level security;

create policy weekly_goals_read on public.weekly_goals for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.weekly_goals to authenticated;

-- O retrato da semana, usado tanto por quem só lê quanto por quem acabou de jurar.
create function private.weekly_goal_view(p_user_id uuid)
returns table (
  target integer,
  week_start date,
  days_trained boolean[],
  days_done integer,
  goal_met boolean,
  streak_days integer,
  weeks_in_a_row integer
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_week constant date := private.week_start(now());
  v_today constant date := private.sao_paulo_date(now());
  v_target integer;
  v_days boolean[];
  v_done integer;
  v_met boolean;
  v_streak integer := 0;
  v_weeks integer := 0;
  v_last_day date;
  v_week_anchor date;
begin
  select g.target into v_target
  from public.weekly_goals as g
  where g.user_id = p_user_id and g.week_start <= v_week
  order by g.week_start desc
  limit 1;
  -- Zero e "nunca jurou" viram a mesma coisa para quem lê: não há meta em vigor.
  v_target := nullif(coalesce(v_target, 0), 0);

  select array_agg(
           exists (
             select 1 from public.workouts as w
             where w.user_id = p_user_id and w.local_date = v_week + g.n
           )
           order by g.n
         )
  into v_days
  from generate_series(0, 6) as g(n);

  select count(*)::integer into v_done from unnest(v_days) as dia where dia;
  v_met := v_target is not null and v_done >= v_target;

  /*
   * Sequência de dias: o dia de hoje ainda não terminou, então quem treinou ontem e ainda não
   * treinou hoje continua com a sequência viva. A âncora é o último dia treinado, desde que seja
   * hoje ou ontem; mais velho que isso, a sequência já foi quebrada.
   *
   * A contagem usa a distância até a âncora: a n-ésima data mais recente só continua a sequência
   * se for exatamente `âncora - (n-1)` dias. Depois de um buraco, nenhuma data volta a bater.
   */
  select max(w.local_date) into v_last_day
  from public.workouts as w
  where w.user_id = p_user_id and w.local_date between v_today - 1 and v_today;

  if v_last_day is not null then
    select count(*)::integer into v_streak
    from (
      select dias.local_date as dia, (row_number() over (order by dias.local_date desc))::integer as posicao
      from (
        select distinct w.local_date
        from public.workouts as w
        where w.user_id = p_user_id and w.local_date <= v_last_day
      ) as dias
    ) as seq
    where seq.dia = v_last_day - (seq.posicao - 1);
  end if;

  -- Chama de Vesta: mesma contagem, em passos de sete dias, sobre as semanas cumpridas.
  v_week_anchor := case when v_met then v_week else v_week - 7 end;

  with semanas as (
    select w.week_start as semana, count(distinct w.local_date)::integer as dias
    from public.workouts as w
    where w.user_id = p_user_id
    group by w.week_start
  ),
  cumpridas as (
    select s.semana
    from semanas as s
    -- Sem juramento em vigor, a semana não conta: não se cumpre promessa que não foi feita.
    cross join lateral (
      select g.target
      from public.weekly_goals as g
      where g.user_id = p_user_id and g.week_start <= s.semana
      order by g.week_start desc
      limit 1
    ) as meta
    where meta.target > 0 and s.dias >= meta.target
  ),
  ordenadas as (
    select c.semana, (row_number() over (order by c.semana desc))::integer as posicao
    from cumpridas as c
    where c.semana <= v_week_anchor
  )
  select count(*)::integer into v_weeks
  from ordenadas as o
  where o.semana = v_week_anchor - (o.posicao - 1) * 7;

  return query select v_target, v_week, v_days, v_done, v_met, v_streak, v_weeks;
end;
$$;

comment on function private.weekly_goal_view(uuid) is
  'Retrato do juramento: meta em vigor, dias treinados na semana, sequência de dias e Chama de Vesta.';

-- A gravação mora aqui porque `week_start` é coluna da tabela e também nome de saída da RPC: numa
-- função com esse parâmetro de saída, o `insert ... (user_id, week_start, target)` fica ambíguo.
create function private.swear_weekly_goal(p_user_id uuid, p_target integer)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into public.weekly_goals (user_id, week_start, target)
  values (p_user_id, private.week_start(now()), p_target::smallint)
  on conflict (user_id, week_start) do update set target = excluded.target, set_at = now();
$$;

comment on function private.swear_weekly_goal(uuid, integer) is
  'Grava o juramento da semana corrente, substituindo o que já houvesse nela.';

create function public.my_weekly_goal()
returns table (
  target integer,
  week_start date,
  days_trained boolean[],
  days_done integer,
  goal_met boolean,
  streak_days integer,
  weeks_in_a_row integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query select * from private.weekly_goal_view(private.require_profile());
end;
$$;

comment on function public.my_weekly_goal() is
  'Juramento da semana de quem pede: meta, dias cumpridos, sequência de dias e Chama de Vesta.';

create function public.set_weekly_goal(p_target integer)
returns table (
  target integer,
  week_start date,
  days_trained boolean[],
  days_done integer,
  goal_met boolean,
  streak_days integer,
  weeks_in_a_row integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
begin
  if p_target is null or p_target not between 0 and 7 then
    raise exception 'invalid_goal' using errcode = 'P0001';
  end if;

  -- Jurar de novo na mesma semana substitui o juramento dela; as semanas passadas ficam como foram.
  perform private.swear_weekly_goal(v_user_id, p_target);

  return query select * from private.weekly_goal_view(v_user_id);
end;
$$;

comment on function public.set_weekly_goal(integer) is
  'Faz o juramento da semana corrente (0 a 7 dias). Vale a partir desta semana e não muda a Glória nem o Coliseu.';

revoke all on function private.weekly_goal_view(uuid) from public, anon, authenticated;
revoke all on function private.swear_weekly_goal(uuid, integer) from public, anon, authenticated;
revoke all on function public.my_weekly_goal() from public, anon, authenticated;
revoke all on function public.set_weekly_goal(integer) from public, anon, authenticated;
grant execute on function public.my_weekly_goal() to authenticated;
grant execute on function public.set_weekly_goal(integer) to authenticated;
