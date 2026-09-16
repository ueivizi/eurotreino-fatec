-- EuroTreino · emblemas novos e cor do emblema
--
-- O perfil continua sem foto (decisão de privacidade: menos dado pessoal, nada de imagem para
-- moderar). A personalização vem da lista maior de emblemas e de uma cor escolhida entre materiais
-- da identidade: ouro, bronze, prata, pórfiro, oliva e terracota.
--
-- A cor é um identificador fechado, nunca um hexadecimal vindo do app: cor livre viraria entrada
-- do usuário desenhando na tela dos outros, e a paleta perderia o sentido.

create or replace function private.is_valid_emblem(p_value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- coalesce: nulo é emblema inválido, não "desconhecido". Sem isso, o insert seguiria e a
  -- mensagem viria da restrição da tabela, em vez do erro estável que o app traduz.
  select coalesce(p_value in (
    'aguia', 'loba', 'leao', 'coruja', 'pegaso', 'tridente', 'raio', 'elmo',
    'touro', 'serpente', 'fenix', 'lira'
  ), false);
$$;

create function private.is_valid_emblem_color(p_value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(p_value in ('ouro', 'bronze', 'prata', 'porfiro', 'oliva', 'terracota'), false);
$$;

comment on function private.is_valid_emblem_color(text) is
  'Cores do emblema: lista fechada de materiais da identidade. O app nunca envia hexadecimal.';

alter table public.profiles
  add column emblem_color text not null default 'ouro'
  constraint profiles_emblem_color_allowed check (private.is_valid_emblem_color(emblem_color));

comment on column public.profiles.emblem_color is 'Cor do emblema, escolhida entre os materiais da identidade.';

-- RF002: criar e editar o perfil, agora com a cor do emblema. Sem cor informada, mantém a atual
-- (ou "ouro", no primeiro acesso), para que uma versão antiga do app não apague a escolha.
drop function public.complete_profile(text, text);

create function public.complete_profile(
  p_display_name text,
  p_emblem text,
  p_emblem_color text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := auth.uid();
  v_display_name text;
  v_emblem_color text;
  v_current public.profiles;
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
  if p_emblem_color is not null and not private.is_valid_emblem_color(p_emblem_color) then
    raise exception 'invalid_emblem_color' using errcode = 'P0001';
  end if;

  -- Serializa as edições do usuário: o limite não é burlável com envios paralelos.
  select p.* into v_current from public.profiles as p where p.id = v_user_id for update;

  if found then
    v_emblem_color := coalesce(p_emblem_color, v_current.emblem_color);
    if v_current.display_name = v_display_name
       and v_current.emblem = p_emblem
       and v_current.emblem_color = v_emblem_color then
      return v_current;
    end if;
    if private.recent_actions(v_user_id, null, 'profile.updated', interval '24 hours') >= 10 then
      raise exception 'rate_limited' using errcode = 'PT429';
    end if;

    update public.profiles as p
    set display_name = v_display_name,
        emblem = p_emblem,
        emblem_color = v_emblem_color,
        updated_at = now()
    where p.id = v_user_id
    returning p.* into v_profile;

    perform private.audit(v_user_id, 'profile.updated', null);
    return v_profile;
  end if;

  -- Primeiro acesso. Em corrida entre duas abas, a segunda vira uma atualização comum.
  v_emblem_color := coalesce(p_emblem_color, 'ouro');
  insert into public.profiles as p (id, display_name, emblem, emblem_color)
  values (v_user_id, v_display_name, p_emblem, v_emblem_color)
  on conflict (id) do update
    set display_name = excluded.display_name,
        emblem = excluded.emblem,
        emblem_color = excluded.emblem_color,
        updated_at = now()
  returning p.* into v_profile;

  return v_profile;
end;
$$;

-- A Arena mostra a cor de cada membro: sem isso, a escolha só apareceria para o próprio dono.
drop function public.group_weekly_ranking(uuid, integer);

create function public.group_weekly_ranking(p_group_id uuid, p_week_offset integer default 0)
returns table (
  user_id uuid,
  display_name text,
  emblem text,
  emblem_color text,
  role text,
  week_glory integer,
  total_glory integer,
  place integer,
  is_me boolean,
  week_start date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id constant uuid := private.require_profile();
  v_week_start date;
begin
  if p_week_offset is null or p_week_offset not in (0, -1) then
    raise exception 'invalid_week_offset' using errcode = 'P0001';
  end if;
  if not private.is_group_member(p_group_id) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  v_week_start := private.week_start(now()) + (p_week_offset * 7);

  return query
    with member_glory as (
      select
        gm.user_id,
        gm.role,
        coalesce(sum(w.points) filter (where w.week_start = v_week_start), 0)::integer as week_glory,
        coalesce(sum(w.points), 0)::integer as total_glory
      from public.group_members as gm
      left join public.workouts as w on w.user_id = gm.user_id
      where gm.group_id = p_group_id
      group by gm.user_id, gm.role
    )
    select
      mg.user_id,
      p.display_name,
      p.emblem,
      p.emblem_color,
      mg.role,
      mg.week_glory,
      mg.total_glory,
      (rank() over (order by mg.week_glory desc))::integer,
      mg.user_id = v_user_id,
      v_week_start
    from member_glory as mg
    join public.profiles as p on p.id = mg.user_id
    order by mg.week_glory desc, p.display_name;
end;
$$;

revoke all on function public.complete_profile(text, text, text) from public, anon, authenticated;
revoke all on function public.group_weekly_ranking(uuid, integer) from public, anon, authenticated;
grant execute on function public.complete_profile(text, text, text) to authenticated;
grant execute on function public.group_weekly_ranking(uuid, integer) to authenticated;
