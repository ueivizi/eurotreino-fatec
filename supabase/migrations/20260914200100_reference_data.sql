-- EuroTreino · dados de referência: tipos de treino, emblemas e ranks
--
-- Os valores espelham src/features/workouts/workout-types.ts, src/components/ui/icon.tsx
-- (EMBLEMS) e src/features/ranks/tiers.ts. O teste de sincronia do banco falha se divergirem.

create table public.workout_types (
  id text primary key constraint workout_types_id_format check (id ~ '^[a-z]{2,20}$'),
  label text not null constraint workout_types_label_length check (char_length(label) between 2 and 40),
  sort_order smallint not null unique constraint workout_types_sort_order_positive check (sort_order > 0),
  is_active boolean not null default true
);

comment on table public.workout_types is 'Tipos de treino aceitos no registro (lista fechada).';
comment on column public.workout_types.id is 'Identificador estável usado pelo app (ex.: musculacao).';
comment on column public.workout_types.label is 'Nome exibido em português.';
comment on column public.workout_types.sort_order is 'Ordem de exibição na grade de tipos.';
comment on column public.workout_types.is_active is 'Tipos inativos deixam de ser aceitos em novos registros.';

insert into public.workout_types (id, label, sort_order) values
  ('musculacao', 'Musculação', 1),
  ('corrida', 'Corrida', 2),
  ('caminhada', 'Caminhada', 3),
  ('bike', 'Bike', 4),
  ('natacao', 'Natação', 5),
  ('funcional', 'Funcional', 6),
  ('esporte', 'Esporte', 7),
  ('yoga', 'Yoga', 8),
  ('outro', 'Outro', 9);

-- Cursus Gloriae: cada linha é uma divisão; `id` segue a ordem de subida (1 = Recruta III).
create table public.rank_tiers (
  id smallint primary key constraint rank_tiers_id_positive check (id > 0),
  tier smallint not null constraint rank_tiers_tier_range check (tier between 1 and 7),
  tier_name text not null,
  division smallint constraint rank_tiers_division_range check (division between 1 and 3),
  min_glory integer not null unique constraint rank_tiers_min_glory_non_negative check (min_glory >= 0),
  constraint rank_tiers_tier_division_unique unique nulls not distinct (tier, division)
);

comment on table public.rank_tiers is 'Ranks "Da Legião ao Olimpo": Glória mínima de cada divisão. Ajustável após o piloto.';
comment on column public.rank_tiers.id is 'Posição da divisão na escada de ranks (1 = Recruta III).';
comment on column public.rank_tiers.tier is 'Rank de 1 (Recruta) a 7 (Olimpiano).';
comment on column public.rank_tiers.tier_name is 'Nome do rank exibido ao usuário.';
comment on column public.rank_tiers.division is 'Divisão: 3 = III, 2 = II, 1 = I. Nula no Olimpiano, que não tem divisões.';
comment on column public.rank_tiers.min_glory is 'Glória acumulada mínima para alcançar a divisão.';

insert into public.rank_tiers (id, tier, tier_name, division, min_glory) values
  (1, 1, 'Recruta', 3, 0),
  (2, 1, 'Recruta', 2, 35),
  (3, 1, 'Recruta', 1, 70),
  (4, 2, 'Legionário', 3, 100),
  (5, 2, 'Legionário', 2, 165),
  (6, 2, 'Legionário', 1, 230),
  (7, 3, 'Centurião', 3, 300),
  (8, 3, 'Centurião', 2, 415),
  (9, 3, 'Centurião', 1, 530),
  (10, 4, 'Gladiador', 3, 650),
  (11, 4, 'Gladiador', 2, 835),
  (12, 4, 'Gladiador', 1, 1015),
  (13, 5, 'Herói', 3, 1200),
  (14, 5, 'Herói', 2, 1465),
  (15, 5, 'Herói', 1, 1735),
  (16, 6, 'Semideus', 3, 2000),
  (17, 6, 'Semideus', 2, 2500),
  (18, 6, 'Semideus', 1, 3000),
  (19, 7, 'Olimpiano', null, 3500);

-- Leitura liberada só para usuários autenticados; ninguém grava pela API.
revoke all on table public.workout_types, public.rank_tiers from anon, authenticated;
grant select on table public.workout_types, public.rank_tiers to authenticated;

alter table public.workout_types enable row level security;
alter table public.rank_tiers enable row level security;

create policy workout_types_select_authenticated on public.workout_types
  for select to authenticated
  using (true);

create policy rank_tiers_select_authenticated on public.rank_tiers
  for select to authenticated
  using (true);

-- Emblemas (perfil e estandarte da Legião): lista fechada, igual à do app.
create function private.is_valid_emblem(p_value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(p_value in ('aguia', 'loba', 'leao', 'coruja', 'pegaso', 'tridente', 'raio', 'elmo'), false);
$$;

revoke all on function private.is_valid_emblem(text) from public;
