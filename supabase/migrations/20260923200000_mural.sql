-- EuroTreino · Mural da Legião (P7): conversa entre membros, com moderação desde o começo
--
-- A idade mínima do app é 16 anos. Conversa aberta sem moderação, num app que junta gente que se
-- conhece por um código de convite, é como a feature vira problema -- então a moderação entra
-- junto com a primeira mensagem, não depois:
--
--   * **só membro escreve e só membro lê**, dentro da própria Legião (RLS e RPC conferem os dois);
--   * **sem link**: o mural recusa qualquer endereço. Legião é lugar de combinar treino, não de
--     receber "clique aqui". É a defesa mais barata que existe contra golpe e phishing;
--   * **quem escreveu apaga**, e **o fundador apaga qualquer uma** -- é a Legião dele;
--   * **denúncia em dois toques**: quem denuncia para de ver a mensagem na hora, e três denúncias
--     escondem a mensagem de todo mundo até o fundador decidir. O fundador pode apagar ou liberar;
--     liberada, ela não some de novo por denúncia -- a decisão dele vale mais que a contagem;
--   * **limite de 30 mensagens por hora** por pessoa em cada Legião, contra inundação;
--   * apagar a conta leva junto as mensagens e as denúncias de quem sai (LGPD).
--
-- O que o mural **não** tem, de propósito: foto, mensagem privada, edição depois de enviada e
-- qualquer forma de falar com quem não é da Legião.

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null constraint group_messages_body_length check (length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  -- Moderação: escondida por denúncia ou pelo fundador; liberada, fica imune à contagem.
  hidden_at timestamptz,
  reports_count smallint not null default 0 constraint group_messages_reports_non_negative check (reports_count >= 0),
  cleared_at timestamptz
);

comment on table public.group_messages is 'Mensagens do Mural de uma Legião. Só membros leem e escrevem; sem link, sem foto, sem mensagem privada.';
comment on column public.group_messages.hidden_at is 'Escondida de todos: três denúncias ou decisão do fundador.';
comment on column public.group_messages.cleared_at is 'Liberada pelo fundador: denúncia nova não a esconde outra vez.';

create index group_messages_group_idx on public.group_messages (group_id, created_at desc);

create table public.message_reports (
  message_id uuid not null references public.group_messages (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_at timestamptz not null default now(),
  primary key (message_id, reporter_id)
);

comment on table public.message_reports is 'Denúncias de mensagem do Mural. Uma por pessoa; quem denuncia para de ver a mensagem.';

alter table public.group_messages enable row level security;
alter table public.message_reports enable row level security;

/*
 * Leitura direta da tabela: membro da Legião vê o que não está escondido e o que ele mesmo
 * escreveu. A lista que o app usa é a RPC, que ainda tira o que a pessoa denunciou e mostra ao
 * fundador o que está retido -- mas a política precisa valer por si, caso alguém leia a tabela.
 */
create policy group_messages_read on public.group_messages for select to authenticated
  using (private.is_group_member(group_id) and (hidden_at is null or author_id = (select auth.uid())));

create policy message_reports_read on public.message_reports for select to authenticated
  using (reporter_id = (select auth.uid()));

grant select on public.group_messages, public.message_reports to authenticated;

-- Endereço em qualquer forma reconhecível. Sem quantificador aninhado: nada de retrocesso caro.
create function private.has_link(p_text text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_text ~* '(https?://|www\.|[[:alnum:]][[:alnum:]-]*\.(com|net|org|br|io|app|me|gg|co|xyz|link|info|shop|site)([^[:alnum:]]|$))';
$$;

comment on function private.has_link(text) is
  'Verdadeiro quando o texto tem endereço de internet. O Mural recusa link: é a defesa mais barata contra golpe.';

-- Texto do mural: sem controles, sem espaço sobrando e sem parágrafo vazio em cima de parágrafo vazio.
create function private.clean_message(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        replace(coalesce(p_text, ''), E'\r\n', E'\n'),
        -- Tudo o que é controle sai, menos a quebra de linha: parágrafo a pessoa pode fazer.
        '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]', '', 'g'
      ),
      '\n{3,}', E'\n\n', 'g'
    )
  );
$$;

create function public.post_message(p_group_id uuid, p_body text)
returns table (
  message_id uuid,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_body constant text := private.clean_message(p_body);
  v_id uuid;
  v_at timestamptz;
begin
  if p_group_id is null or not exists (
    select 1 from public.group_members as gm where gm.group_id = p_group_id and gm.user_id = v_user_id
  ) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  if length(v_body) = 0 or length(v_body) > 500 then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;
  if private.has_link(v_body) then
    raise exception 'link_not_allowed' using errcode = 'P0001';
  end if;

  if private.recent_actions(v_user_id, p_group_id, 'mural.posted', interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  insert into public.group_messages as gm (group_id, author_id, body)
  values (p_group_id, v_user_id, v_body)
  returning gm.id, gm.created_at into v_id, v_at;

  perform private.audit(v_user_id, 'mural.posted', p_group_id);
  return query select v_id, v_at;
end;
$$;

comment on function public.post_message(uuid, text) is
  'Escreve no Mural da própria Legião (até 500 caracteres, sem link, 30 por hora).';

create function public.group_mural(p_group_id uuid, p_before timestamptz default null)
returns table (
  message_id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  display_name text,
  emblem text,
  emblem_color text,
  is_mine boolean,
  is_owner_message boolean,
  /* Retida: escondida de todos, esperando o fundador. Só ele recebe essas linhas. */
  is_held boolean,
  reports_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_is_owner boolean;
begin
  select gm.role = 'owner' into v_is_owner
  from public.group_members as gm
  where gm.group_id = p_group_id and gm.user_id = v_user_id;
  if not found then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  return query
    select
      m.id,
      m.body,
      m.created_at,
      m.author_id,
      p.display_name,
      p.emblem,
      p.emblem_color,
      m.author_id = v_user_id,
      coalesce(author.role = 'owner', false),
      m.hidden_at is not null,
      case when v_is_owner then m.reports_count::integer else 0 end
    from public.group_messages as m
    join public.profiles as p on p.id = m.author_id
    left join public.group_members as author on author.group_id = m.group_id and author.user_id = m.author_id
    where m.group_id = p_group_id
      and (p_before is null or m.created_at < p_before)
      /*
       * Escondida some para todo mundo, menos para duas pessoas: o fundador, que precisa decidir o
       * que fazer com ela, e quem a escreveu -- que merece saber que foi retida, em vez de achar
       * que a mensagem sumiu e escrever de novo.
       */
      and (m.hidden_at is null or v_is_owner or m.author_id = v_user_id)
      /*
       * Quem denunciou não vê mais aquela mensagem, nem que ela volte a aparecer para os outros.
       * O fundador é a exceção: moderar exige enxergar, inclusive o que ele mesmo denunciou.
       */
      and (
        v_is_owner
        or not exists (
          select 1 from public.message_reports as r where r.message_id = m.id and r.reporter_id = v_user_id
        )
      )
    order by m.created_at desc
    limit 50;
end;
$$;

comment on function public.group_mural(uuid, timestamptz) is
  'Mural da Legião, do mais recente para o mais antigo. Esconde o que foi denunciado por quem pede e o que está retido (menos para o fundador).';

create function public.delete_message(p_message_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
  v_message public.group_messages;
begin
  select m.* into v_message from public.group_messages as m where m.id = p_message_id;
  -- Mensagem de Legião alheia e mensagem inexistente dão o mesmo erro: a resposta não revela nada.
  if not found or not exists (
    select 1 from public.group_members as gm where gm.group_id = v_message.group_id and gm.user_id = v_user_id
  ) then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;

  if v_message.author_id <> v_user_id and not exists (
    select 1 from public.group_members as gm
    where gm.group_id = v_message.group_id and gm.user_id = v_user_id and gm.role = 'owner'
  ) then
    raise exception 'not_group_owner' using errcode = 'P0001';
  end if;

  delete from public.group_messages as m where m.id = p_message_id;
  perform private.audit(v_user_id, 'mural.deleted', v_message.group_id);
end;
$$;

comment on function public.delete_message(uuid) is
  'Apaga uma mensagem do Mural: quem escreveu ou o fundador da Legião.';

create function public.report_message(p_message_id uuid)
returns table (reports_count integer, is_held boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_message public.group_messages;
  v_count integer;
  v_hidden boolean;
begin
  select m.* into v_message from public.group_messages as m where m.id = p_message_id for update;
  if not found or not exists (
    select 1 from public.group_members as gm where gm.group_id = v_message.group_id and gm.user_id = v_user_id
  ) then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if v_message.author_id = v_user_id then
    raise exception 'cannot_report_own' using errcode = 'P0001';
  end if;

  insert into public.message_reports (message_id, reporter_id)
  values (p_message_id, v_user_id)
  on conflict (message_id, reporter_id) do nothing;

  -- Três denúncias escondem a mensagem -- a não ser que o fundador já a tenha liberado.
  update public.group_messages as m
  set
    reports_count = (select count(*) from public.message_reports as r where r.message_id = m.id),
    hidden_at = case
      when m.cleared_at is not null then m.hidden_at
      when (select count(*) from public.message_reports as r where r.message_id = m.id) >= 3 then coalesce(m.hidden_at, now())
      else m.hidden_at
    end
  where m.id = p_message_id
  returning m.reports_count::integer, m.hidden_at is not null into v_count, v_hidden;

  perform private.audit(v_user_id, 'mural.reported', v_message.group_id);
  return query select v_count, v_hidden;
end;
$$;

comment on function public.report_message(uuid) is
  'Denuncia uma mensagem: quem denuncia para de vê-la, e três denúncias a escondem até o fundador decidir.';

create function public.clear_message_reports(p_message_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
  v_message public.group_messages;
begin
  select m.* into v_message from public.group_messages as m where m.id = p_message_id;
  if not found or not exists (
    select 1 from public.group_members as gm where gm.group_id = v_message.group_id and gm.user_id = v_user_id
  ) then
    raise exception 'message_not_found' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.group_members as gm
    where gm.group_id = v_message.group_id and gm.user_id = v_user_id and gm.role = 'owner'
  ) then
    raise exception 'not_group_owner' using errcode = 'P0001';
  end if;

  -- A decisão do fundador vale mais que a contagem: liberada, a mensagem não some de novo.
  update public.group_messages as m
  set hidden_at = null, cleared_at = now()
  where m.id = p_message_id;

  perform private.audit(v_user_id, 'mural.cleared', v_message.group_id);
end;
$$;

comment on function public.clear_message_reports(uuid) is
  'Libera uma mensagem retida por denúncias. Só o fundador, e a decisão dele vale para sempre.';

revoke all on function private.has_link(text) from public, anon, authenticated;
revoke all on function private.clean_message(text) from public, anon, authenticated;
revoke all on function public.post_message(uuid, text) from public, anon, authenticated;
revoke all on function public.group_mural(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.delete_message(uuid) from public, anon, authenticated;
revoke all on function public.report_message(uuid) from public, anon, authenticated;
revoke all on function public.clear_message_reports(uuid) from public, anon, authenticated;

grant execute on function public.post_message(uuid, text) to authenticated;
grant execute on function public.group_mural(uuid, timestamptz) to authenticated;
grant execute on function public.delete_message(uuid) to authenticated;
grant execute on function public.report_message(uuid) to authenticated;
grant execute on function public.clear_message_reports(uuid) to authenticated;
