-- EuroTreino · catálogo de exercícios e fichas de treino
--
-- O catálogo é dado de referência versionado aqui, não uma API de terceiro consultada em tempo de
-- execução: funciona sem internet e sem chave, não quebra quando o serviço de fora cai, e ninguém
-- de fora fica sabendo o que cada pessoa treina. A base veio do Free Exercise DB (domínio público),
-- curada e traduzida para os exercícios que aparecem de fato numa academia brasileira.
--
-- Quem precisar de algo fora da lista cria um exercício próprio, privado: `owner_id` nulo é catálogo,
-- `owner_id` preenchido é seu e só seu.

create table public.muscle_groups (
  id text primary key constraint muscle_groups_id_format check (id ~ '^[a-z-]{3,20}$'),
  label text not null,
  sort_order smallint not null unique constraint muscle_groups_sort_positive check (sort_order > 0)
);

comment on table public.muscle_groups is 'Grupos musculares usados para organizar o catálogo de exercícios.';

insert into public.muscle_groups (id, label, sort_order) values
  ('peito', 'Peito', 1),
  ('costas', 'Costas', 2),
  ('ombros', 'Ombros', 3),
  ('biceps', 'Bíceps', 4),
  ('triceps', 'Tríceps', 5),
  ('antebraco', 'Antebraço', 6),
  ('quadriceps', 'Quadríceps', 7),
  ('posterior', 'Posterior de coxa', 8),
  ('gluteos', 'Glúteos', 9),
  ('panturrilhas', 'Panturrilhas', 10),
  ('abdomen', 'Abdômen', 11),
  ('lombar', 'Lombar', 12),
  ('corpo-inteiro', 'Corpo inteiro', 13);

create table public.equipment (
  id text primary key constraint equipment_id_format check (id ~ '^[a-z-]{3,20}$'),
  label text not null,
  sort_order smallint not null unique constraint equipment_sort_positive check (sort_order > 0)
);

comment on table public.equipment is 'Equipamentos usados para filtrar o catálogo de exercícios.';

insert into public.equipment (id, label, sort_order) values
  ('barra', 'Barra', 1),
  ('halteres', 'Halteres', 2),
  ('maquina', 'Máquina', 3),
  ('cabo', 'Cabo', 4),
  ('peso-corporal', 'Peso do corpo', 5),
  ('kettlebell', 'Kettlebell', 6),
  ('elastico', 'Elástico', 7),
  ('outro', 'Outro', 8);

create table public.exercises (
  id text primary key constraint exercises_id_format check (id ~ '^[a-z0-9-]{3,60}$'),
  -- Nulo = catálogo do app; preenchido = exercício criado por essa pessoa, visível só para ela.
  owner_id uuid references public.profiles (id) on delete cascade,
  name text not null constraint exercises_name_length check (char_length(name) between 2 and 60),
  muscle_group text not null references public.muscle_groups (id),
  equipment text not null references public.equipment (id),
  is_active boolean not null default true,
  sort_order smallint,
  created_at timestamptz not null default now(),
  constraint exercises_catalog_has_order check (owner_id is not null or sort_order is not null),
  constraint exercises_owner_name_unique unique (owner_id, name)
);

comment on table public.exercises is 'Exercícios do catálogo (owner_id nulo) e os criados por cada pessoa (owner_id preenchido).';
comment on column public.exercises.owner_id is 'Dono do exercício personalizado; nulo no catálogo do app.';

create index exercises_owner_idx on public.exercises (owner_id) where owner_id is not null;
create index exercises_group_idx on public.exercises (muscle_group, sort_order) where owner_id is null;

-- Catálogo: 98 exercícios cobrindo todos os grupos musculares e os equipamentos de uma academia
-- comum. Lista fechada e versionada: o que faltar, cada pessoa cria como exercício próprio.
insert into public.exercises (id, name, muscle_group, equipment, sort_order) values
  ('supino-reto-barra', 'Supino reto com barra', 'peito', 'barra', 1),
  ('supino-reto-halteres', 'Supino reto com halteres', 'peito', 'halteres', 2),
  ('supino-inclinado-barra', 'Supino inclinado com barra', 'peito', 'barra', 3),
  ('supino-inclinado-halteres', 'Supino inclinado com halteres', 'peito', 'halteres', 4),
  ('supino-declinado', 'Supino declinado', 'peito', 'barra', 5),
  ('supino-maquina', 'Supino na máquina', 'peito', 'maquina', 6),
  ('crucifixo-halteres', 'Crucifixo com halteres', 'peito', 'halteres', 7),
  ('crucifixo-maquina', 'Crucifixo na máquina (voador)', 'peito', 'maquina', 8),
  ('crossover', 'Crossover no cabo', 'peito', 'cabo', 9),
  ('flexao-de-braco', 'Flexão de braço', 'peito', 'peso-corporal', 10),
  ('pullover', 'Pullover com halter', 'peito', 'halteres', 11),
  ('barra-fixa', 'Barra fixa', 'costas', 'peso-corporal', 12),
  ('barra-fixa-supinada', 'Barra fixa supinada', 'costas', 'peso-corporal', 13),
  ('puxada-frente', 'Puxada pela frente', 'costas', 'cabo', 14),
  ('puxada-triangulo', 'Puxada com triângulo', 'costas', 'cabo', 15),
  ('remada-curvada', 'Remada curvada com barra', 'costas', 'barra', 16),
  ('remada-unilateral', 'Remada unilateral com halter', 'costas', 'halteres', 17),
  ('remada-cavalinho', 'Remada cavalinho', 'costas', 'barra', 18),
  ('remada-maquina', 'Remada na máquina', 'costas', 'maquina', 19),
  ('remada-baixa', 'Remada baixa no cabo', 'costas', 'cabo', 20),
  ('levantamento-terra', 'Levantamento terra', 'costas', 'barra', 21),
  ('pulldown-braco-reto', 'Pulldown com braços retos', 'costas', 'cabo', 22),
  ('encolhimento', 'Encolhimento de ombros', 'costas', 'halteres', 23),
  ('desenvolvimento-militar', 'Desenvolvimento militar', 'ombros', 'barra', 24),
  ('desenvolvimento-halteres', 'Desenvolvimento com halteres', 'ombros', 'halteres', 25),
  ('desenvolvimento-maquina', 'Desenvolvimento na máquina', 'ombros', 'maquina', 26),
  ('elevacao-lateral', 'Elevação lateral', 'ombros', 'halteres', 27),
  ('elevacao-frontal', 'Elevação frontal', 'ombros', 'halteres', 28),
  ('crucifixo-inverso', 'Crucifixo inverso', 'ombros', 'halteres', 29),
  ('remada-alta', 'Remada alta', 'ombros', 'barra', 30),
  ('face-pull', 'Face pull', 'ombros', 'cabo', 31),
  ('arnold-press', 'Desenvolvimento Arnold', 'ombros', 'halteres', 32),
  ('rosca-direta', 'Rosca direta com barra', 'biceps', 'barra', 33),
  ('rosca-alternada', 'Rosca alternada com halteres', 'biceps', 'halteres', 34),
  ('rosca-martelo', 'Rosca martelo', 'biceps', 'halteres', 35),
  ('rosca-scott', 'Rosca Scott', 'biceps', 'barra', 36),
  ('rosca-concentrada', 'Rosca concentrada', 'biceps', 'halteres', 37),
  ('rosca-cabo', 'Rosca no cabo', 'biceps', 'cabo', 38),
  ('rosca-inversa', 'Rosca inversa', 'biceps', 'barra', 39),
  ('triceps-testa', 'Tríceps testa', 'triceps', 'barra', 40),
  ('triceps-corda', 'Tríceps na corda', 'triceps', 'cabo', 41),
  ('triceps-barra-cabo', 'Tríceps barra no cabo', 'triceps', 'cabo', 42),
  ('triceps-frances', 'Tríceps francês', 'triceps', 'halteres', 43),
  ('triceps-coice', 'Tríceps coice', 'triceps', 'halteres', 44),
  ('mergulho-banco', 'Mergulho no banco', 'triceps', 'peso-corporal', 45),
  ('paralelas', 'Paralelas', 'triceps', 'peso-corporal', 46),
  ('rosca-punho', 'Rosca de punho', 'antebraco', 'barra', 47),
  ('rosca-punho-inversa', 'Rosca de punho inversa', 'antebraco', 'barra', 48),
  ('farmer-walk', 'Caminhada do fazendeiro', 'antebraco', 'halteres', 49),
  ('pendura-na-barra', 'Pendura na barra', 'antebraco', 'peso-corporal', 50),
  ('agachamento-livre', 'Agachamento livre', 'quadriceps', 'barra', 51),
  ('agachamento-frontal', 'Agachamento frontal', 'quadriceps', 'barra', 52),
  ('agachamento-hack', 'Agachamento hack', 'quadriceps', 'maquina', 53),
  ('agachamento-goblet', 'Agachamento goblet', 'quadriceps', 'kettlebell', 54),
  ('agachamento-corpo', 'Agachamento com peso do corpo', 'quadriceps', 'peso-corporal', 55),
  ('agachamento-sumo', 'Agachamento sumô', 'quadriceps', 'halteres', 56),
  ('agachamento-bulgaro', 'Agachamento búlgaro', 'quadriceps', 'halteres', 57),
  ('leg-press', 'Leg press', 'quadriceps', 'maquina', 58),
  ('cadeira-extensora', 'Cadeira extensora', 'quadriceps', 'maquina', 59),
  ('afundo', 'Afundo', 'quadriceps', 'halteres', 60),
  ('passada', 'Passada', 'quadriceps', 'halteres', 61),
  ('mesa-flexora', 'Mesa flexora', 'posterior', 'maquina', 62),
  ('flexora-em-pe', 'Flexora em pé', 'posterior', 'maquina', 63),
  ('stiff', 'Stiff com barra', 'posterior', 'barra', 64),
  ('stiff-halteres', 'Stiff com halteres', 'posterior', 'halteres', 65),
  ('terra-romeno', 'Levantamento terra romeno', 'posterior', 'barra', 66),
  ('good-morning', 'Good morning', 'posterior', 'barra', 67),
  ('flexora-nordica', 'Flexora nórdica', 'posterior', 'peso-corporal', 68),
  ('elevacao-pelvica', 'Elevação pélvica com barra', 'gluteos', 'barra', 69),
  ('ponte-de-gluteo', 'Ponte de glúteo', 'gluteos', 'peso-corporal', 70),
  ('gluteo-maquina', 'Glúteo na máquina', 'gluteos', 'maquina', 71),
  ('coice-cabo', 'Coice no cabo', 'gluteos', 'cabo', 72),
  ('abducao-maquina', 'Abdução na máquina', 'gluteos', 'maquina', 73),
  ('abducao-elastico', 'Abdução com elástico', 'gluteos', 'elastico', 74),
  ('panturrilha-em-pe', 'Panturrilha em pé', 'panturrilhas', 'maquina', 75),
  ('panturrilha-sentado', 'Panturrilha sentado', 'panturrilhas', 'maquina', 76),
  ('panturrilha-leg-press', 'Panturrilha no leg press', 'panturrilhas', 'maquina', 77),
  ('abdominal-supra', 'Abdominal supra', 'abdomen', 'peso-corporal', 78),
  ('abdominal-infra', 'Abdominal infra', 'abdomen', 'peso-corporal', 79),
  ('prancha', 'Prancha', 'abdomen', 'peso-corporal', 80),
  ('prancha-lateral', 'Prancha lateral', 'abdomen', 'peso-corporal', 81),
  ('elevacao-de-pernas', 'Elevação de pernas na barra', 'abdomen', 'peso-corporal', 82),
  ('abdominal-cabo', 'Abdominal no cabo', 'abdomen', 'cabo', 83),
  ('russian-twist', 'Russian twist', 'abdomen', 'outro', 84),
  ('ab-wheel', 'Roda abdominal', 'abdomen', 'outro', 85),
  ('hiperextensao', 'Hiperextensão lombar', 'lombar', 'peso-corporal', 86),
  ('extensao-lombar-maquina', 'Extensão lombar na máquina', 'lombar', 'maquina', 87),
  ('superman', 'Superman', 'lombar', 'peso-corporal', 88),
  ('burpee', 'Burpee', 'corpo-inteiro', 'peso-corporal', 89),
  ('thruster', 'Thruster', 'corpo-inteiro', 'barra', 90),
  ('clean', 'Clean', 'corpo-inteiro', 'barra', 91),
  ('snatch', 'Arranco (snatch)', 'corpo-inteiro', 'barra', 92),
  ('kettlebell-swing', 'Swing com kettlebell', 'corpo-inteiro', 'kettlebell', 93),
  ('wall-ball', 'Wall ball', 'corpo-inteiro', 'outro', 94),
  ('mountain-climber', 'Escalador', 'corpo-inteiro', 'peso-corporal', 95),
  ('corda-naval', 'Corda naval', 'corpo-inteiro', 'outro', 96),
  ('agachamento-com-salto', 'Agachamento com salto', 'corpo-inteiro', 'peso-corporal', 97),
  ('polichinelo', 'Polichinelo', 'corpo-inteiro', 'peso-corporal', 98);

-- Fichas de treino ("Peito e tríceps", "Treino A"). Cada uma é de uma pessoa só.
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null constraint routines_name_length check (char_length(btrim(name)) between 2 and 40),
  position smallint not null default 1 constraint routines_position_range check (position between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_user_name_unique unique (user_id, name)
);

comment on table public.routines is 'Fichas de treino: lista ordenada de exercícios com séries, repetições e carga previstas.';

create index routines_user_idx on public.routines (user_id, position);

create table public.routine_exercises (
  routine_id uuid not null references public.routines (id) on delete cascade,
  position smallint not null constraint routine_exercises_position_range check (position between 1 and 30),
  exercise_id text not null references public.exercises (id),
  target_sets smallint not null constraint routine_exercises_sets_range check (target_sets between 1 and 20),
  target_reps smallint not null constraint routine_exercises_reps_range check (target_reps between 1 and 100),
  target_load_kg numeric(5, 1)
    constraint routine_exercises_load_range check (
      target_load_kg is null or (target_load_kg between 0.5 and 500 and (target_load_kg * 2) = floor(target_load_kg * 2))
    ),
  rest_seconds smallint constraint routine_exercises_rest_range check (rest_seconds is null or rest_seconds between 10 and 600),
  primary key (routine_id, position),
  constraint routine_exercises_unique unique (routine_id, exercise_id)
);

comment on table public.routine_exercises is 'Exercícios de uma ficha, na ordem em que são feitos.';

alter table public.muscle_groups enable row level security;
alter table public.equipment enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;

-- Leitura: as listas de apoio são públicas para quem está autenticado; exercício personalizado e
-- ficha são só do dono. Escrita não tem política nenhuma: só as RPCs abaixo gravam.
create policy muscle_groups_read on public.muscle_groups for select to authenticated using (true);
create policy equipment_read on public.equipment for select to authenticated using (true);
create policy exercises_read on public.exercises for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy routines_read on public.routines for select to authenticated
  using (user_id = (select auth.uid()));
create policy routine_exercises_read on public.routine_exercises for select to authenticated
  using (exists (select 1 from public.routines as r where r.id = routine_id and r.user_id = (select auth.uid())));

grant select on public.muscle_groups, public.equipment, public.exercises, public.routines, public.routine_exercises to authenticated;

-- Exercício próprio: o identificador é gerado aqui, a partir do nome, e nunca vem do app — assim
-- ninguém escolhe o id de outra pessoa nem colide com o catálogo.
create function public.create_exercise(p_name text, p_muscle_group text, p_equipment text)
returns public.exercises
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
  v_name text;
  v_slug text;
  v_id text;
  v_exercise public.exercises;
begin
  if p_name is null or char_length(p_name) > 60 then
    raise exception 'invalid_exercise_name' using errcode = 'P0001';
  end if;
  v_name := normalize(btrim(p_name), nfc);
  -- Mesmas regras do nome de exibição: letras, números e pontuação simples, sem marcação.
  if char_length(v_name) < 2 or v_name !~ '^[[:alnum:] ()''\-\.]{2,60}$' then
    raise exception 'invalid_exercise_name' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.muscle_groups as g where g.id = p_muscle_group) then
    raise exception 'invalid_muscle_group' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.equipment as e where e.id = p_equipment) then
    raise exception 'invalid_equipment' using errcode = 'P0001';
  end if;

  -- Até 50 exercícios próprios por pessoa: o suficiente para qualquer ficha, longe de virar despejo.
  if (select count(*) from public.exercises as e where e.owner_id = v_user_id) >= 50 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  -- translate() no lugar da extensão unaccent: uma dependência a menos, e o slug só precisa ser
  -- estável e legível (a identidade de verdade é o uuid no fim).
  v_slug := lower(translate(v_name, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'));
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := btrim(v_slug, '-');
  if char_length(v_slug) < 3 then
    v_slug := 'exercicio';
  end if;
  v_id := left('meu-' || v_slug, 48) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

  insert into public.exercises as e (id, owner_id, name, muscle_group, equipment)
  values (v_id, v_user_id, v_name, p_muscle_group, p_equipment)
  returning e.* into v_exercise;

  return v_exercise;
end;
$$;

-- Salva a ficha inteira de uma vez: nome e lista de exercícios na ordem. Receber tudo junto evita
-- ficha pela metade se a conexão cair no meio, e a lista é conferida item a item antes de gravar.
create function public.save_routine(p_routine_id uuid, p_name text, p_items jsonb)
returns public.routines
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
  v_name text;
  v_count integer;
  v_routine public.routines;
  v_item jsonb;
  v_position integer := 0;
  v_exercise_id text;
  v_sets integer;
  v_reps integer;
  v_load numeric;
  v_rest integer;
begin
  if p_name is null or char_length(p_name) > 64 then
    raise exception 'invalid_routine_name' using errcode = 'P0001';
  end if;
  v_name := normalize(btrim(p_name), nfc);
  if char_length(v_name) < 2 or char_length(v_name) > 40 or v_name !~ '^[[:alnum:] ()''\-\.]{2,40}$' then
    raise exception 'invalid_routine_name' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_routine_items' using errcode = 'P0001';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 30 then
    raise exception 'invalid_routine_items' using errcode = 'P0001';
  end if;

  if p_routine_id is null then
    -- Até 20 fichas por pessoa.
    if (select count(*) from public.routines as r where r.user_id = v_user_id) >= 20 then
      raise exception 'rate_limited' using errcode = 'PT429';
    end if;
    insert into public.routines as r (user_id, name, position)
    values (
      v_user_id,
      v_name,
      least(50, coalesce((select max(x.position) from public.routines as x where x.user_id = v_user_id), 0) + 1)
    )
    returning r.* into v_routine;
  else
    -- A checagem de dono fica junto da escrita: id de ficha alheia não encontra linha nenhuma.
    update public.routines as r
    set name = v_name, updated_at = now()
    where r.id = p_routine_id and r.user_id = v_user_id
    returning r.* into v_routine;
    if not found then
      raise exception 'routine_not_found' using errcode = 'P0001';
    end if;
    delete from public.routine_exercises as re where re.routine_id = v_routine.id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_position := v_position + 1;
    v_exercise_id := v_item ->> 'exercise_id';
    -- Só entra exercício do catálogo ou seu: assim uma ficha não vira sonda para descobrir
    -- exercícios personalizados de outra pessoa.
    if not exists (
      select 1 from public.exercises as e
      where e.id = v_exercise_id and e.is_active and (e.owner_id is null or e.owner_id = v_user_id)
    ) then
      raise exception 'invalid_exercise' using errcode = 'P0001';
    end if;

    begin
      v_sets := (v_item ->> 'target_sets')::integer;
      v_reps := (v_item ->> 'target_reps')::integer;
      v_load := nullif(v_item ->> 'target_load_kg', '')::numeric;
      v_rest := nullif(v_item ->> 'rest_seconds', '')::integer;
    exception
      when others then
        raise exception 'invalid_routine_items' using errcode = 'P0001';
    end;

    if v_sets is null or v_sets not between 1 and 20 then
      raise exception 'invalid_routine_items' using errcode = 'P0001';
    end if;
    if v_reps is null or v_reps not between 1 and 100 then
      raise exception 'invalid_routine_items' using errcode = 'P0001';
    end if;
    if v_load is not null and (v_load not between 0.5 and 500 or (v_load * 2) <> floor(v_load * 2)) then
      raise exception 'invalid_routine_items' using errcode = 'P0001';
    end if;
    if v_rest is not null and v_rest not between 10 and 600 then
      raise exception 'invalid_routine_items' using errcode = 'P0001';
    end if;

    insert into public.routine_exercises (routine_id, position, exercise_id, target_sets, target_reps, target_load_kg, rest_seconds)
    values (v_routine.id, v_position, v_exercise_id, v_sets, v_reps, v_load, v_rest);
  end loop;

  return v_routine;
end;
$$;

create function public.delete_routine(p_routine_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
begin
  delete from public.routines as r where r.id = p_routine_id and r.user_id = v_user_id;
  return found;
end;
$$;

revoke all on function public.create_exercise(text, text, text) from public, anon, authenticated;
revoke all on function public.save_routine(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.delete_routine(uuid) from public, anon, authenticated;
grant execute on function public.create_exercise(text, text, text) to authenticated;
grant execute on function public.save_routine(uuid, text, jsonb) to authenticated;
grant execute on function public.delete_routine(uuid) to authenticated;
