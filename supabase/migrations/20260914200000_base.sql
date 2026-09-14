-- EuroTreino · base do banco
--
-- Postura: nada nasce exposto. O Supabase concede por padrão acesso total a `anon` e
-- `authenticated` sobre todo objeto novo do esquema `public`; aqui isso é revogado, e cada
-- migração concede explicitamente só o que o app precisa. A regra de negócio mora em funções
-- `security definer` com `search_path` vazio; o app nunca grava em tabelas diretamente.

create extension if not exists pgcrypto with schema extensions;

-- Esquema interno: auxiliares e tabelas que o app nunca acessa diretamente.
-- Não está em [api].schemas, então a Data API não o expõe.
create schema if not exists private;
revoke all on schema private from public;

-- Objetos criados daqui em diante pelo `postgres` nascem sem acesso para os papéis da API.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
-- No Postgres, toda função nasce executável por PUBLIC; isso só é revogável sem esquema.
alter default privileges for role postgres revoke execute on functions from public;

-- Semana da Arena: de segunda 00:00 a domingo 23:59:59 no horário de São Paulo.
-- As funções são `stable` (e não `immutable`) porque dependem da base de fusos do servidor.

create function private.sao_paulo_date(p_at timestamptz)
returns date
language sql
stable
parallel safe
set search_path = ''
as $$
  select (p_at at time zone 'America/Sao_Paulo')::date;
$$;

comment on function private.sao_paulo_date(timestamptz) is
  'Data civil de um instante no fuso America/Sao_Paulo.';

create function private.week_start(p_at timestamptz)
returns date
language sql
stable
parallel safe
set search_path = ''
as $$
  select date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date;
$$;

comment on function private.week_start(timestamptz) is
  'Segunda-feira (America/Sao_Paulo) da semana da Arena que contém o instante.';

revoke all on function private.sao_paulo_date(timestamptz) from public;
revoke all on function private.week_start(timestamptz) from public;
