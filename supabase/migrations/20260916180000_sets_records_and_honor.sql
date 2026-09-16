-- EuroTreino · séries, recordes por exercício e Honra
--
-- Honra é a progressão pessoal: por exercício, na musculação, e por modalidade, na resistência.
-- Ela NÃO entra na Arena. A Arena disputa Glória, que vem da regra v1 (presença, duração,
-- intensidade e constância) e é igual para todo mundo. Se carga e distância virassem Glória, quem
-- levanta mais e corre mais ganharia sempre, e a disputa entre amigos perderia a graça — é o
-- oposto do que o produto existe para fazer.
--
-- Honra sobe devagar e com teto por dia: repetir o mesmo exercício dez vezes no mesmo dia não
-- rende dez vezes mais. O que rende é voltar em outro dia e bater o próprio recorde.

create table public.honor_levels (
  id smallint primary key constraint honor_levels_id_positive check (id > 0),
  name text not null,
  min_points integer not null unique constraint honor_levels_points_non_negative check (min_points >= 0)
);

comment on table public.honor_levels is 'Níveis de Honra: progressão pessoal por exercício e por modalidade. Não tem relação com a Arena.';

insert into public.honor_levels (id, name, min_points) values
  (1, 'Aprendiz', 0),
  (2, 'Praticante', 50),
  (3, 'Veterano', 150),
  (4, 'Mestre', 350),
  (5, 'Lenda', 700);

-- Séries de um treino de força. Uma linha por série feita, na ordem.
create table public.workout_sets (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  position smallint not null constraint workout_sets_position_range check (position between 1 and 200),
  exercise_id text not null references public.exercises (id),
  reps smallint not null constraint workout_sets_reps_range check (reps between 1 and 200),
  -- Nulo em exercício com peso do corpo: barra fixa não tem carga para anotar.
  load_kg numeric(5, 1)
    constraint workout_sets_load_range check (
      load_kg is null or (load_kg between 0.5 and 500 and (load_kg * 2) = floor(load_kg * 2))
    ),
  primary key (workout_id, position)
);

comment on table public.workout_sets is 'Séries feitas em um treino de força: exercício, repetições e carga.';

create index workout_sets_exercise_idx on public.workout_sets (exercise_id, workout_id);

-- Recorde pessoal por exercício. Uma linha por pessoa e exercício, sempre a melhor marca.
create table public.exercise_records (
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  best_load_kg numeric(5, 1),
  best_reps smallint,
  -- Carga estimada para uma repetição (fórmula de Epley): compara séries de pesos e repetições
  -- diferentes numa medida só. É estimativa, e a tela diz isso.
  best_e1rm numeric(6, 2),
  best_volume_kg numeric(9, 1),
  achieved_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

comment on table public.exercise_records is 'Melhor marca de cada pessoa em cada exercício. Só o dono lê.';
comment on column public.exercise_records.best_e1rm is 'Carga estimada para 1 repetição (Epley): carga x (1 + reps/30).';

create table public.honor (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Exatamente um dos dois: Honra é de um exercício ou de uma modalidade.
  exercise_id text references public.exercises (id),
  workout_type text references public.workout_types (id),
  points integer not null default 0 constraint honor_points_non_negative check (points >= 0),
  updated_at timestamptz not null default now(),
  constraint honor_one_scope check (num_nonnulls(exercise_id, workout_type) = 1)
);

comment on table public.honor is 'Honra acumulada por exercício ou por modalidade. Progressão pessoal, fora da Arena.';

create unique index honor_exercise_unique on public.honor (user_id, exercise_id) where exercise_id is not null;
create unique index honor_type_unique on public.honor (user_id, workout_type) where workout_type is not null;

alter table public.honor_levels enable row level security;
alter table public.workout_sets enable row level security;
alter table public.exercise_records enable row level security;
alter table public.honor enable row level security;

create policy honor_levels_read on public.honor_levels for select to authenticated using (true);
-- Série é detalhe do treino, e treino é só do dono (RF009): nem a Legião vê.
create policy workout_sets_read on public.workout_sets for select to authenticated
  using (exists (select 1 from public.workouts as w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy exercise_records_read on public.exercise_records for select to authenticated
  using (user_id = (select auth.uid()));
create policy honor_read on public.honor for select to authenticated using (user_id = (select auth.uid()));

grant select on public.honor_levels, public.workout_sets, public.exercise_records, public.honor to authenticated;

-- Soma Honra no lugar certo, criando a linha na primeira vez.
create function private.grant_honor(
  p_user_id uuid,
  p_exercise_id text,
  p_workout_type text,
  p_points integer
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_points <= 0 then
    return;
  end if;

  if p_exercise_id is not null then
    insert into public.honor as h (user_id, exercise_id, points)
    values (p_user_id, p_exercise_id, p_points)
    on conflict (user_id, exercise_id) where exercise_id is not null
      do update set points = h.points + excluded.points, updated_at = now();
  else
    insert into public.honor as h (user_id, workout_type, points)
    values (p_user_id, p_workout_type, p_points)
    on conflict (user_id, workout_type) where workout_type is not null
      do update set points = h.points + excluded.points, updated_at = now();
  end if;
end;
$$;

-- Honra da modalidade: concedida no próprio insert do treino, para valer tanto no registro comum
-- quanto no treino de força e não depender de o app lembrar de pedir.
create function private.on_workout_logged()
returns trigger
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_first_today boolean;
  v_previous_best integer;
begin
  -- +3 no primeiro treino da modalidade no dia. O segundo do mesmo dia não rende de novo.
  select not exists (
    select 1 from public.workouts as w
    where w.user_id = new.user_id
      and w.workout_type = new.workout_type
      and w.local_date = new.local_date
      and w.id <> new.id
  ) into v_first_today;

  if v_first_today then
    perform private.grant_honor(new.user_id, null, new.workout_type, 3);
  end if;

  -- +7 ao superar a própria melhor distância na modalidade.
  if new.distance_m is not null then
    select max(w.distance_m) into v_previous_best
    from public.workouts as w
    where w.user_id = new.user_id
      and w.workout_type = new.workout_type
      and w.distance_m is not null
      and w.id <> new.id;
    if v_previous_best is not null and new.distance_m > v_previous_best then
      perform private.grant_honor(new.user_id, null, new.workout_type, 7);
    end if;
  end if;

  return null;
end;
$$;

create trigger workouts_honor_after_insert
after insert on public.workouts
for each row execute function private.on_workout_logged();

-- RF006 para musculação: registra o treino e as séries de uma vez, calcula recordes e Honra.
-- Devolve jsonb porque a resposta tem três partes (treino, recordes e Honra) e uma tabela plana
-- obrigaria o app a remontar tudo.
create function public.log_strength_workout(
  p_client_request_id uuid,
  p_workout_type text,
  p_duration_min integer,
  p_intensity text,
  p_sets jsonb,
  p_performed_at timestamptz default null,
  p_routine_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_module text;
  v_logged public.workouts;
  v_result record;
  v_item jsonb;
  v_position integer := 0;
  v_exercise_id text;
  v_reps integer;
  v_load numeric;
  v_count integer;
  v_records jsonb := '[]'::jsonb;
  v_honor jsonb := '[]'::jsonb;
  v_exercise text;
  v_best_e1rm numeric;
  v_best_load numeric;
  v_best_reps integer;
  v_volume numeric;
  v_previous public.exercise_records;
  v_gained integer;
begin
  select wt.module into v_module
  from public.workout_types as wt
  where wt.id = p_workout_type and wt.is_active;
  if not found then
    raise exception 'invalid_workout_type' using errcode = 'P0001';
  end if;
  if v_module <> 'forca' then
    raise exception 'sets_not_allowed' using errcode = 'P0001';
  end if;

  if p_sets is null or jsonb_typeof(p_sets) <> 'array' then
    raise exception 'invalid_sets_list' using errcode = 'P0001';
  end if;
  v_count := jsonb_array_length(p_sets);
  if v_count < 1 or v_count > 200 then
    raise exception 'invalid_sets_list' using errcode = 'P0001';
  end if;

  if p_routine_id is not null and not exists (
    select 1 from public.routines as r where r.id = p_routine_id and r.user_id = v_user_id
  ) then
    raise exception 'routine_not_found' using errcode = 'P0001';
  end if;

  -- O treino em si passa pelo mesmo núcleo de sempre: mesma Glória, mesmos tetos, mesma janela
  -- de 48 horas e a mesma idempotência por client_request_id.
  select * into v_result
  from private.log_workout_for(
    v_user_id, now(), p_client_request_id, p_workout_type, p_duration_min, p_intensity, p_performed_at
  );

  select * into v_logged from public.workouts as w where w.id = v_result.workout_id;

  -- Reenvio: as séries já foram gravadas na primeira vez, e nada é recalculado.
  if v_result.replayed then
    return jsonb_build_object(
      'workout', to_jsonb(v_result),
      'records', '[]'::jsonb,
      'honor', '[]'::jsonb
    );
  end if;

  for v_item in select * from jsonb_array_elements(p_sets) loop
    v_position := v_position + 1;
    v_exercise_id := v_item ->> 'exercise_id';
    if not exists (
      select 1 from public.exercises as e
      where e.id = v_exercise_id and e.is_active and (e.owner_id is null or e.owner_id = v_user_id)
    ) then
      raise exception 'invalid_exercise' using errcode = 'P0001';
    end if;

    begin
      v_reps := (v_item ->> 'reps')::integer;
      v_load := nullif(v_item ->> 'load_kg', '')::numeric;
    exception
      when others then
        raise exception 'invalid_sets_list' using errcode = 'P0001';
    end;

    if v_reps is null or v_reps not between 1 and 200 then
      raise exception 'invalid_sets_list' using errcode = 'P0001';
    end if;
    if v_load is not null and (v_load not between 0.5 and 500 or (v_load * 2) <> floor(v_load * 2)) then
      raise exception 'invalid_sets_list' using errcode = 'P0001';
    end if;

    insert into public.workout_sets (workout_id, position, exercise_id, reps, load_kg)
    values (v_logged.id, v_position, v_exercise_id, v_reps, v_load);
  end loop;

  -- Recordes e Honra, um exercício por vez.
  for v_exercise in
    select distinct s.exercise_id from public.workout_sets as s where s.workout_id = v_logged.id
  loop
    select
      max(case when s.load_kg is not null then s.load_kg * (1 + s.reps / 30.0) end),
      max(s.load_kg),
      max(s.reps),
      coalesce(sum(coalesce(s.load_kg, 0) * s.reps), 0)
    into v_best_e1rm, v_best_load, v_best_reps, v_volume
    from public.workout_sets as s
    where s.workout_id = v_logged.id and s.exercise_id = v_exercise;

    select * into v_previous
    from public.exercise_records as r
    where r.user_id = v_user_id and r.exercise_id = v_exercise;

    v_gained := 0;
    -- +3 pela primeira aparição do exercício no dia.
    if not exists (
      select 1
      from public.workout_sets as s
      join public.workouts as w on w.id = s.workout_id
      where w.user_id = v_user_id
        and w.local_date = v_logged.local_date
        and s.exercise_id = v_exercise
        and w.id <> v_logged.id
    ) then
      v_gained := v_gained + 3;
    end if;

    if found and v_previous.best_e1rm is not null and v_best_e1rm is not null and v_best_e1rm > v_previous.best_e1rm then
      v_gained := v_gained + 7;
      v_records := v_records || jsonb_build_array(jsonb_build_object(
        'exercise_id', v_exercise,
        'kind', 'e1rm',
        'previous', v_previous.best_e1rm,
        'current', round(v_best_e1rm, 2)
      ));
    end if;

    insert into public.exercise_records as r (user_id, exercise_id, best_load_kg, best_reps, best_e1rm, best_volume_kg)
    values (v_user_id, v_exercise, v_best_load, v_best_reps, round(v_best_e1rm, 2), v_volume)
    on conflict (user_id, exercise_id) do update
      set best_load_kg = greatest(coalesce(r.best_load_kg, 0), coalesce(excluded.best_load_kg, 0)),
          best_reps = greatest(coalesce(r.best_reps, 0), coalesce(excluded.best_reps, 0)),
          best_e1rm = greatest(coalesce(r.best_e1rm, 0), coalesce(excluded.best_e1rm, 0)),
          best_volume_kg = greatest(coalesce(r.best_volume_kg, 0), coalesce(excluded.best_volume_kg, 0)),
          achieved_at = now();

    if v_gained > 0 then
      perform private.grant_honor(v_user_id, v_exercise, null, v_gained);
      v_honor := v_honor || jsonb_build_array(jsonb_build_object(
        'exercise_id', v_exercise,
        'gained', v_gained,
        'points', (select h.points from public.honor as h where h.user_id = v_user_id and h.exercise_id = v_exercise)
      ));
    end if;
  end loop;

  return jsonb_build_object('workout', to_jsonb(v_result), 'records', v_records, 'honor', v_honor);
end;
$$;

-- Honra e recordes do próprio usuário, prontos para a tela.
create function public.my_honor()
returns table (
  exercise_id text,
  exercise_name text,
  workout_type text,
  points integer,
  level_id smallint,
  level_name text,
  next_level_points integer,
  best_load_kg numeric,
  best_reps smallint,
  best_e1rm numeric
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
      h.exercise_id,
      e.name,
      h.workout_type,
      h.points,
      lvl.id,
      lvl.name,
      (select min(n.min_points) from public.honor_levels as n where n.min_points > h.points),
      r.best_load_kg,
      r.best_reps,
      r.best_e1rm
    from public.honor as h
    left join public.exercises as e on e.id = h.exercise_id
    left join public.exercise_records as r on r.user_id = h.user_id and r.exercise_id = h.exercise_id
    cross join lateral (
      select l.id, l.name
      from public.honor_levels as l
      where l.min_points <= h.points
      order by l.min_points desc
      limit 1
    ) as lvl
    where h.user_id = v_user_id
    order by h.points desc, e.name nulls first;
end;
$$;

revoke all on function private.grant_honor(uuid, text, text, integer) from public;
revoke all on function private.on_workout_logged() from public;
revoke all on function public.log_strength_workout(uuid, text, integer, text, jsonb, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.my_honor() from public, anon, authenticated;
grant execute on function public.log_strength_workout(uuid, text, integer, text, jsonb, timestamptz, uuid) to authenticated;
grant execute on function public.my_honor() to authenticated;
