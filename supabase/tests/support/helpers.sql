-- Auxiliares dos testes do banco. O executor os cria dentro da transação de cada arquivo de
-- teste, e tudo é desfeito no fim (rollback), inclusive no projeto hospedado.

create schema tests;
grant usage on schema tests to anon, authenticated;

-- Valores guardados entre passos de um teste (ids de usuários, Legiões, códigos de convite).
create table tests.memory (
  key text primary key,
  value text not null
);
grant select, insert, update on table tests.memory to anon, authenticated;

create function tests.remember(p_key text, p_value text)
returns text
language sql
as $$
  insert into tests.memory (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value
  returning value;
$$;

create function tests.recall(p_key text)
returns text
language plpgsql
stable
as $$
declare
  v_value text;
begin
  select m.value into v_value from tests.memory as m where m.key = p_key;
  if v_value is null then
    raise exception 'Nada guardado com a chave "%"', p_key;
  end if;
  return v_value;
end;
$$;

-- Usuário no Auth, sem perfil (como logo após o primeiro login).
create function tests.create_user(p_name text)
returns uuid
language plpgsql
as $$
declare
  v_id constant uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role)
  values (v_id, p_name || '@eurotreino.test', 'authenticated', 'authenticated');
  perform tests.remember(p_name, v_id::text);
  return v_id;
end;
$$;

create function tests.user_id(p_name text)
returns uuid
language sql
stable
as $$
  select tests.recall(p_name)::uuid;
$$;

-- Usuário com perfil completo, criado direto na tabela (preparo, fora das RPCs).
create function tests.create_member(p_name text, p_display_name text, p_emblem text default 'aguia')
returns uuid
language plpgsql
as $$
declare
  v_id constant uuid := tests.create_user(p_name);
begin
  insert into public.profiles (id, display_name, emblem) values (v_id, p_display_name, p_emblem);
  return v_id;
end;
$$;

-- Legião criada direto nas tabelas (preparo). p_members na ordem de entrada; o primeiro é o fundador.
create function tests.create_legion(p_key text, p_name text, p_members text[])
returns uuid
language plpgsql
as $$
declare
  v_group_id constant uuid := gen_random_uuid();
begin
  insert into public.groups (id, name, emblem) values (v_group_id, p_name, 'aguia');
  insert into public.group_members (group_id, user_id, role, joined_at)
  select
    v_group_id,
    tests.user_id(member.name),
    case when member.ord = 1 then 'owner' else 'member' end,
    now() - interval '30 days' + member.ord * interval '1 hour'
  from unnest(p_members) with ordinality as member (name, ord);
  perform tests.remember(p_key, v_group_id::text);
  return v_group_id;
end;
$$;

-- Troca o papel da sessão, como a Data API faz a cada requisição.
create function tests.authenticate_as(p_name text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', tests.user_id(p_name), 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

create function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function tests.assert_true(p_description text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'FALHOU: %', p_description;
  end if;
end;
$$;

create function tests.assert_equal(p_description text, p_actual anyelement, p_expected anyelement)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALHOU: % (esperado: %, obtido: %)', p_description, p_expected, p_actual;
  end if;
end;
$$;

-- Executa p_sql com o papel atual e exige um erro cuja mensagem case com p_expected (LIKE).
create function tests.assert_raises(p_description text, p_sql text, p_expected text)
returns void
language plpgsql
as $$
declare
  v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_message = message_text;
  end;

  if v_message is null then
    raise exception 'FALHOU: % (esperava o erro "%", mas não houve erro)', p_description, p_expected;
  end if;
  if v_message not like p_expected then
    raise exception 'FALHOU: % (esperava o erro "%", obtido "%")', p_description, p_expected, v_message;
  end if;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;
