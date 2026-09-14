-- Reproduz, no PGlite, só o que as migrações e os testes usam de um projeto Supabase:
-- os papéis da Data API, o esquema auth com auth.uid(), o esquema extensions e os
-- privilégios padrão PERMISSIVOS que o Supabase aplica ao esquema public. Assim os testes
-- provam que as migrações se fecham sozinhas, e não que o ambiente de teste já era fechado.
-- Usado apenas nos testes locais; nunca é aplicado a um projeto real.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  aud text,
  role text,
  created_at timestamptz not null default now()
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;

-- O Supabase roda em UTC; as regras de semana não podem depender do fuso da sessão.
set timezone = 'UTC';
