-- EuroTreino · contas e Legiões
--
-- RF002 perfil inicial · RF003 fundar Legião · RF004 convidar por link ou código ·
-- RF005 entrar por código · RF009 perfis visíveis só para quem compartilha Legião ·
-- NF014 convites aleatórios, válidos por 7 dias, com no máximo 10 tentativas inválidas por hora.
-- Contra spam, cada RPC que grava tem limite por período (fundar, entrar, trocar código).
--
-- Erros esperados saem como códigos estáveis (ex.: 'invalid_group_name'), que o app traduz.
-- Nenhuma mensagem leva detalhes internos.

-- Validação ------------------------------------------------------------------------------------

create function private.is_valid_display_name(p_value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- 2 a 32 caracteres: letras latinas (com acento), dígitos, espaço simples, ponto, apóstrofo e hífen.
  select coalesce(
    p_value is nfc normalized
    and char_length(p_value) between 2 and 32
    and p_value ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9]([A-Za-zÀ-ÖØ-öø-ÿ0-9 .''-]*[A-Za-zÀ-ÖØ-öø-ÿ0-9.])?$'
    and strpos(p_value, '  ') = 0,
    false
  );
$$;

create function private.is_valid_group_name(p_value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- 3 a 40 caracteres, mesmo alfabeto do nome de exibição, mais "&" e "!".
  select coalesce(
    p_value is nfc normalized
    and char_length(p_value) between 3 and 40
    and p_value ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9]([A-Za-zÀ-ÖØ-öø-ÿ0-9 .''&!-]*[A-Za-zÀ-ÖØ-öø-ÿ0-9.!])?$'
    and strpos(p_value, '  ') = 0,
    false
  );
$$;

-- Aceita "abcd-efgh", "ABCD EFGH" etc. Entradas longas nem são processadas.
create function private.normalize_invite_code(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_value is null or char_length(p_value) > 32 then null
    else upper(translate(p_value, ' -', ''))
  end;
$$;

-- 40 bits de gerador criptográfico → 8 símbolos de 5 bits num alfabeto de 32 (sem viés).
-- O alfabeto omite 0, 1, I e O para evitar confusão na hora de digitar.
create function private.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes constant bytea := extensions.gen_random_bytes(5);
  v_bits bigint := 0;
  v_code text := '';
begin
  for i in 0..4 loop
    v_bits := (v_bits << 8) | get_byte(v_bytes, i);
  end loop;
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, ((v_bits >> (35 - 5 * i)) & 31)::integer + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- Tabelas --------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null constraint profiles_display_name_format check (private.is_valid_display_name(display_name)),
  emblem text not null constraint profiles_emblem_allowed check (private.is_valid_emblem(emblem)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil do usuário, visível só para ele e para quem compartilha ao menos uma Legião (RF009). Sem foto nem dados sensíveis.';
comment on column public.profiles.id is 'Mesmo identificador do usuário no Supabase Auth.';
comment on column public.profiles.display_name is 'Nome de exibição (2 a 32 caracteres, normalizado em NFC).';
comment on column public.profiles.emblem is 'Emblema escolhido no lugar de foto.';

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint groups_name_format check (private.is_valid_group_name(name)),
  emblem text not null constraint groups_emblem_allowed check (private.is_valid_emblem(emblem)),
  created_at timestamptz not null default now()
);

comment on table public.groups is 'Legião: grupo privado de até 50 membros, visível só para os próprios membros.';
comment on column public.groups.name is 'Nome da Legião (3 a 40 caracteres).';
comment on column public.groups.emblem is 'Emblema do estandarte da Legião.';

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' constraint group_members_role_allowed check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

comment on table public.group_members is 'Membros de cada Legião. Cada Legião tem exatamente um fundador (owner).';
comment on column public.group_members.role is 'owner = fundador (pode gerar novo convite); member = membro.';
comment on column public.group_members.joined_at is 'Entrada na Legião; define o sucessor quando o fundador sai.';

create unique index group_members_single_owner on public.group_members (group_id) where role = 'owner';
create index group_members_user_id_idx on public.group_members (user_id);

create table private.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  code text not null
    constraint group_invites_code_format check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$')
    constraint group_invites_code_unique unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint group_invites_expires_after_creation check (expires_at > created_at)
);

comment on table private.group_invites is 'Códigos de convite. No máximo um aberto por Legião; um código nunca é reutilizado.';
comment on column private.group_invites.code is 'Código de 8 caracteres (exibido como XXXX-XXXX).';
comment on column private.group_invites.expires_at is 'Fim da validade: 7 dias após a emissão.';
comment on column private.group_invites.revoked_at is 'Preenchido quando o código é substituído.';

create unique index group_invites_single_open on private.group_invites (group_id) where revoked_at is null;
create index group_invites_group_id_idx on private.group_invites (group_id);
create index group_invites_created_by_idx on private.group_invites (created_by);

create table private.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

comment on table private.join_attempts is 'Tentativas com código de convite inválido, para o limite de 10 por hora (NF014). Retenção de 1 dia.';

create index join_attempts_user_recent_idx on private.join_attempts (user_id, attempted_at desc);

create table private.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null constraint audit_log_action_format check (action ~ '^[a-z_]+\.[a-z_]+$'),
  group_id uuid references public.groups (id) on delete set null
);

comment on table private.audit_log is 'Eventos de segurança (Legiões, convites, limite de tentativas). Nunca guarda códigos, nomes ou tokens.';

create index audit_log_actor_id_idx on private.audit_log (actor_id, action, occurred_at);
create index audit_log_group_id_idx on private.audit_log (group_id);

-- Auxiliares internas ----------------------------------------------------------------------------

create function private.audit(p_actor_id uuid, p_action text, p_group_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into private.audit_log (actor_id, action, group_id) values (p_actor_id, p_action, p_group_id);
$$;

-- Usuário autenticado e com perfil; falha fechado em qualquer outro caso.
create function private.require_profile()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user_id constant uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles as p where p.id = v_user_id) then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;
  return v_user_id;
end;
$$;

-- Emite um código novo. Só repete a tentativa em colisão de código; qualquer outro erro sobe.
create function private.issue_invite(p_group_id uuid, p_actor_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
volatile
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_code text;
  v_expires_at timestamptz;
  v_constraint text;
begin
  for attempt in 1..5 loop
    begin
      insert into private.group_invites as gi (group_id, code, created_by, expires_at)
      values (p_group_id, private.generate_invite_code(), p_actor_id, now() + interval '7 days')
      returning gi.code, gi.expires_at into v_code, v_expires_at;

      perform private.audit(p_actor_id, 'invite.issued', p_group_id);
      return query select v_code, v_expires_at;
      return;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'group_invites_code_unique' or attempt = 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- Devolve o convite aberto da Legião, emitindo outro se o atual venceu.
create function private.open_invite(p_group_id uuid, p_actor_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
volatile
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_invite private.group_invites;
begin
  select gi.* into v_invite
  from private.group_invites as gi
  where gi.group_id = p_group_id and gi.revoked_at is null
  for update;

  if found and v_invite.expires_at > now() then
    return query select v_invite.code, v_invite.expires_at;
    return;
  end if;

  if found then
    update private.group_invites as gi set revoked_at = now() where gi.id = v_invite.id;
  end if;

  return query select issued.code, issued.expires_at from private.issue_invite(p_group_id, p_actor_id) as issued;
end;
$$;

-- NF014: bloqueado com 10 tentativas inválidas na última hora.
create function private.join_blocked(p_user_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select count(*) >= 10
  from private.join_attempts as ja
  where ja.user_id = p_user_id and ja.attempted_at > now() - interval '1 hour';
$$;

create function private.record_invalid_join_attempt(p_user_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  insert into private.join_attempts (user_id) values (p_user_id);

  -- Só a última hora importa para o limite; o resto é descartado.
  delete from private.join_attempts as ja
  where ja.user_id = p_user_id and ja.attempted_at < now() - interval '1 day';

  -- Registra uma única vez a entrada no bloqueio (evita inundar o log).
  if (
    select count(*) from private.join_attempts as ja
    where ja.user_id = p_user_id and ja.attempted_at > now() - interval '1 hour'
  ) = 10 then
    perform private.audit(p_user_id, 'invite.rate_limited', null);
  end if;
end;
$$;

-- Quantas vezes um usuário (ou uma Legião) registrou a ação no período: base dos limites contra spam.
create function private.recent_actions(p_actor_id uuid, p_group_id uuid, p_action text, p_window interval)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from private.audit_log as al
  where al.action = p_action
    and al.occurred_at > now() - p_window
    and (p_actor_id is null or al.actor_id = p_actor_id)
    and (p_group_id is null or al.group_id = p_group_id);
$$;

-- Fundador que sai passa a Legião ao membro mais antigo; Legião sem membros é apagada.
create function private.on_group_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' then
    update public.group_members as gm
    set role = 'owner'
    where gm.group_id = old.group_id
      and gm.user_id = (
        select successor.user_id
        from public.group_members as successor
        where successor.group_id = old.group_id
        order by successor.joined_at, successor.user_id
        limit 1
      );
  end if;

  delete from public.groups as g
  where g.id = old.group_id
    and not exists (select 1 from public.group_members as gm where gm.group_id = old.group_id);

  return null;
end;
$$;

create trigger group_members_after_delete
  after delete on public.group_members
  for each row execute function private.on_group_member_removed();

-- Membresia, usadas pelas políticas de RLS. `security definer` evita recursão nas políticas
-- de group_members; a checagem é sempre contra auth.uid(), nunca contra um parâmetro de usuário.
create function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members as gm
    where gm.group_id = p_group_id and gm.user_id = (select auth.uid())
  );
$$;

create function private.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members as mine
    join public.group_members as theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

-- RPCs do app ----------------------------------------------------------------------------------

-- RF002: cria ou atualiza o próprio perfil.
create function public.complete_profile(p_display_name text, p_emblem text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := auth.uid();
  v_display_name text;
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  -- Entradas enormes são recusadas antes da normalização Unicode, cujo custo cresce com o tamanho.
  if char_length(p_display_name) <= 64 then
    v_display_name := normalize(btrim(p_display_name), nfc);
  end if;
  if not private.is_valid_display_name(v_display_name) then
    raise exception 'invalid_display_name' using errcode = 'P0001';
  end if;
  if not private.is_valid_emblem(p_emblem) then
    raise exception 'invalid_emblem' using errcode = 'P0001';
  end if;

  insert into public.profiles as p (id, display_name, emblem)
  values (v_user_id, v_display_name, p_emblem)
  on conflict (id) do update
    set display_name = excluded.display_name,
        emblem = excluded.emblem,
        updated_at = now()
  returning p.* into v_profile;

  return v_profile;
end;
$$;

-- RF003: funda uma Legião; o fundador entra como owner e o primeiro convite já sai emitido.
create function public.create_group(p_name text, p_emblem text)
returns table (group_id uuid, name text, emblem text, invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_name text;
  v_group_id uuid;
  v_code text;
  v_expires_at timestamptz;
begin
  if char_length(p_name) <= 80 then
    v_name := normalize(btrim(p_name), nfc);
  end if;
  if not private.is_valid_group_name(v_name) then
    raise exception 'invalid_group_name' using errcode = 'P0001';
  end if;
  if not private.is_valid_emblem(p_emblem) then
    raise exception 'invalid_emblem' using errcode = 'P0001';
  end if;

  -- Serializa as operações de Legião do usuário: o limite de 10 não é burlável em paralelo.
  perform 1 from public.profiles as p where p.id = v_user_id for update;

  if (select count(*) from public.group_members as gm where gm.user_id = v_user_id) >= 10 then
    raise exception 'group_limit_reached' using errcode = 'P0001';
  end if;

  -- Fundar e sair em sequência não pode virar spam: no máximo 10 fundações em 24 horas.
  if private.recent_actions(v_user_id, null, 'group.created', interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  insert into public.groups as g (name, emblem) values (v_name, p_emblem) returning g.id into v_group_id;
  insert into public.group_members (group_id, user_id, role) values (v_group_id, v_user_id, 'owner');
  perform private.audit(v_user_id, 'group.created', v_group_id);

  select issued.code, issued.expires_at into v_code, v_expires_at
  from private.issue_invite(v_group_id, v_user_id) as issued;

  return query select v_group_id, v_name, p_emblem, v_code, v_expires_at;
end;
$$;

-- RF004: qualquer membro vê (e compartilha) o convite aberto da Legião.
create function public.get_group_invite(p_group_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
begin
  -- Legião inexistente e Legião alheia dão o mesmo erro: nada a descobrir por tentativa.
  if not exists (
    select 1 from public.group_members as gm where gm.group_id = p_group_id and gm.user_id = v_user_id
  ) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  -- Dois membros pedindo o convite ao mesmo tempo não emitem dois códigos.
  perform 1 from public.groups as g where g.id = p_group_id for update;

  if (select count(*) from public.group_members as gm where gm.group_id = p_group_id) >= 50 then
    raise exception 'group_full' using errcode = 'P0001';
  end if;

  return query select opened.code, opened.expires_at from private.open_invite(p_group_id, v_user_id) as opened;
end;
$$;

-- RF004: só o fundador gera um código novo, o que invalida o anterior.
create function public.regenerate_invite(p_group_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
begin
  if not exists (
    select 1 from public.group_members as gm
    where gm.group_id = p_group_id and gm.user_id = v_user_id and gm.role = 'owner'
  ) then
    raise exception 'not_group_owner' using errcode = '42501';
  end if;

  perform 1 from public.groups as g where g.id = p_group_id for update;

  -- No máximo 10 trocas de código por Legião em 1 hora.
  if private.recent_actions(null, p_group_id, 'invite.revoked', interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  update private.group_invites as gi
  set revoked_at = now()
  where gi.group_id = p_group_id and gi.revoked_at is null;

  perform private.audit(v_user_id, 'invite.revoked', p_group_id);

  return query select issued.code, issued.expires_at from private.issue_invite(p_group_id, v_user_id) as issued;
end;
$$;

-- RF005: prévia do convite (nome, emblema e nº de membros) antes de confirmar a entrada.
-- Código inválido, vencido ou substituído dá o mesmo status e conta como tentativa inválida.
-- Nada é lançado como exceção aqui: a tentativa precisa ficar gravada para o limite valer.
create function public.preview_invite(p_code text)
returns table (status text, group_name text, group_emblem text, member_count integer, is_member boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_code constant text := private.normalize_invite_code(p_code);
  v_group public.groups;
begin
  perform 1 from public.profiles as p where p.id = v_user_id for update;

  if private.join_blocked(v_user_id) then
    return query select 'rate_limited'::text, null::text, null::text, null::integer, null::boolean;
    return;
  end if;

  select g.* into v_group
  from private.group_invites as gi
  join public.groups as g on g.id = gi.group_id
  where gi.code = v_code and gi.revoked_at is null and gi.expires_at > now();

  if not found then
    perform private.record_invalid_join_attempt(v_user_id);
    return query select 'invalid'::text, null::text, null::text, null::integer, null::boolean;
    return;
  end if;

  return query
    select
      'ok'::text,
      v_group.name,
      v_group.emblem,
      (select count(*)::integer from public.group_members as gm where gm.group_id = v_group.id),
      exists (select 1 from public.group_members as gm where gm.group_id = v_group.id and gm.user_id = v_user_id);
end;
$$;

-- RF005: entra na Legião pelo código. Status possíveis: joined, already_member, invalid,
-- rate_limited (tentativas inválidas ou entradas demais), group_full, group_limit_reached.
create function public.join_group_by_code(p_code text)
returns table (status text, group_id uuid, group_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_code constant text := private.normalize_invite_code(p_code);
  v_group public.groups;
begin
  perform 1 from public.profiles as p where p.id = v_user_id for update;

  if private.join_blocked(v_user_id) then
    return query select 'rate_limited'::text, null::uuid, null::text;
    return;
  end if;

  -- A trava na Legião serializa entradas simultâneas: o limite de 50 não estoura.
  select g.* into v_group
  from private.group_invites as gi
  join public.groups as g on g.id = gi.group_id
  where gi.code = v_code and gi.revoked_at is null and gi.expires_at > now()
  for update of g;

  if not found then
    perform private.record_invalid_join_attempt(v_user_id);
    return query select 'invalid'::text, null::uuid, null::text;
    return;
  end if;

  if exists (select 1 from public.group_members as gm where gm.group_id = v_group.id and gm.user_id = v_user_id) then
    return query select 'already_member'::text, v_group.id, v_group.name;
    return;
  end if;

  if (select count(*) from public.group_members as gm where gm.group_id = v_group.id) >= 50 then
    return query select 'group_full'::text, null::uuid, v_group.name;
    return;
  end if;

  if (select count(*) from public.group_members as gm where gm.user_id = v_user_id) >= 10 then
    return query select 'group_limit_reached'::text, null::uuid, v_group.name;
    return;
  end if;

  -- Entrar e sair em sequência não pode virar spam: no máximo 20 entradas em 24 horas.
  if private.recent_actions(v_user_id, null, 'group.joined', interval '24 hours') >= 20 then
    return query select 'rate_limited'::text, null::uuid, null::text;
    return;
  end if;

  insert into public.group_members (group_id, user_id, role) values (v_group.id, v_user_id, 'member');
  perform private.audit(v_user_id, 'group.joined', v_group.id);

  return query select 'joined'::text, v_group.id, v_group.name;
end;
$$;

-- Sai da Legião. Se era o fundador, o membro mais antigo assume; se era o último, a Legião some.
create function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
begin
  perform 1 from public.profiles as p where p.id = v_user_id for update;

  if not exists (
    select 1 from public.group_members as gm where gm.group_id = p_group_id and gm.user_id = v_user_id
  ) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  perform 1 from public.groups as g where g.id = p_group_id for update;

  -- Antes da remoção: se a Legião for apagada, a chave estrangeira do log vira nula.
  perform private.audit(v_user_id, 'group.left', p_group_id);

  delete from public.group_members as gm where gm.group_id = p_group_id and gm.user_id = v_user_id;
end;
$$;

-- Legiões do usuário, na ordem em que ele entrou.
create function public.my_groups()
returns table (group_id uuid, name text, emblem text, role text, member_count integer, joined_at timestamptz)
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
      g.id,
      g.name,
      g.emblem,
      mine.role,
      (select count(*)::integer from public.group_members as gm where gm.group_id = g.id),
      mine.joined_at
    from public.group_members as mine
    join public.groups as g on g.id = mine.group_id
    where mine.user_id = v_user_id
    order by mine.joined_at, g.id;
end;
$$;

-- Privilégios ---------------------------------------------------------------------------------

revoke all on table public.profiles, public.groups, public.group_members from anon, authenticated;
grant select on table public.profiles, public.groups, public.group_members to authenticated;
revoke all on table private.group_invites, private.join_attempts, private.audit_log from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
-- Sem políticas: só as funções acima (donas das tabelas) leem e gravam.
alter table private.group_invites enable row level security;
alter table private.join_attempts enable row level security;
alter table private.audit_log enable row level security;

create policy profiles_select_self_or_legion on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_group_with(id));

create policy groups_select_member on public.groups
  for select to authenticated
  using (private.is_group_member(id));

create policy group_members_select_member on public.group_members
  for select to authenticated
  using (private.is_group_member(group_id));

revoke all on function private.is_valid_display_name(text) from public;
revoke all on function private.is_valid_group_name(text) from public;
revoke all on function private.normalize_invite_code(text) from public;
revoke all on function private.generate_invite_code() from public;
revoke all on function private.audit(uuid, text, uuid) from public;
revoke all on function private.require_profile() from public;
revoke all on function private.issue_invite(uuid, uuid) from public;
revoke all on function private.open_invite(uuid, uuid) from public;
revoke all on function private.join_blocked(uuid) from public;
revoke all on function private.record_invalid_join_attempt(uuid) from public;
revoke all on function private.recent_actions(uuid, uuid, text, interval) from public;
revoke all on function private.on_group_member_removed() from public;
revoke all on function private.is_group_member(uuid) from public;
revoke all on function private.shares_group_with(uuid) from public;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.shares_group_with(uuid) to authenticated;

revoke all on function public.complete_profile(text, text) from public, anon, authenticated;
revoke all on function public.create_group(text, text) from public, anon, authenticated;
revoke all on function public.get_group_invite(uuid) from public, anon, authenticated;
revoke all on function public.regenerate_invite(uuid) from public, anon, authenticated;
revoke all on function public.preview_invite(text) from public, anon, authenticated;
revoke all on function public.join_group_by_code(text) from public, anon, authenticated;
revoke all on function public.leave_group(uuid) from public, anon, authenticated;
revoke all on function public.my_groups() from public, anon, authenticated;
grant execute on function public.complete_profile(text, text) to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.get_group_invite(uuid) to authenticated;
grant execute on function public.regenerate_invite(uuid) to authenticated;
grant execute on function public.preview_invite(text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.my_groups() to authenticated;
