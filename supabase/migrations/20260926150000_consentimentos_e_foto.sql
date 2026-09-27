-- Escolhas de dados e foto de perfil.
--
-- O app passa a perguntar o que a pessoa quer que ele use, uma finalidade por vez (LGPD, art. 8º e
-- art. 11 para saúde). A frequência cardíaca já tinha o seu consentimento; entram dois:
--
--   * foto: uma foto de perfil vista só pelos membros das Legiões da pessoa. Fica num bucket
--     privado (512 KB, só JPEG). Desligar apaga a referência na hora e o app apaga o arquivo; mesmo
--     que o arquivo sobre, ninguém mais o lê, porque a leitura exige o consentimento em vigor;
--   * localizacao: GPS no treino com o app aberto. O trajeto fica no aparelho; o servidor guarda só
--     a escolha, para ela valer em todos os aparelhos da pessoa.
--
-- Nada é ligado por padrão.

alter table public.profiles
  add column photo_consent_at timestamptz,
  add column location_consent_at timestamptz,
  add column avatar_updated_at timestamptz,
  add constraint profiles_avatar_needs_consent check (avatar_updated_at is null or photo_consent_at is not null);

comment on column public.profiles.photo_consent_at is 'Consentimento para a foto de perfil; nulo = sem foto.';
comment on column public.profiles.location_consent_at is 'Consentimento para o GPS no treino (o trajeto fica no aparelho).';
comment on column public.profiles.avatar_updated_at is 'Quando a foto foi trocada pela última vez; nulo = sem foto.';

-- Quem divide Legião lia a tabela inteira pela política de RLS, inclusive a data do consentimento
-- de saúde dos outros. A leitura direta fica só com as colunas de vitrine; os próprios dados
-- (consentimentos incluídos) vêm de my_profile().
revoke select on table public.profiles from authenticated;
grant select (id, display_name, emblem, emblem_color, avatar_updated_at) on table public.profiles to authenticated;

create function public.my_profile()
returns table (
  id uuid,
  display_name text,
  emblem text,
  emblem_color text,
  health_consent_at timestamptz,
  photo_consent_at timestamptz,
  location_consent_at timestamptz,
  avatar_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.emblem, p.emblem_color, p.health_consent_at, p.photo_consent_at, p.location_consent_at, p.avatar_updated_at
  from public.profiles as p
  where p.id = (select auth.uid());
$$;

-- Foto ------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/jpeg'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Caminho único por pessoa: "<id>/avatar.jpg". Qualquer outro nome não é de ninguém.
create function private.avatar_owner(p_name text)
returns uuid
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.jpg$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- Grava a própria foto, e só com o consentimento ligado.
create function private.can_write_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = private.avatar_owner(p_name)
      and p.id = (select auth.uid())
      and p.photo_consent_at is not null
  );
$$;

-- Vê a foto: a própria sempre (para trocar e para apagar o que sobrou depois de desligar, já que
-- apagar exige enxergar a linha) ou a de quem divide uma Legião, com o consentimento em vigor.
create function private.can_see_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = private.avatar_owner(p_name)
      and (
        p.id = (select auth.uid())
        or (p.photo_consent_at is not null and p.avatar_updated_at is not null and private.shares_group_with(p.id))
      )
  );
$$;

create policy avatars_select on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and private.can_see_avatar(name));

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and private.can_write_avatar(name));

create policy avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and private.can_write_avatar(name))
  with check (bucket_id = 'avatars' and private.can_write_avatar(name));

-- Apagar a própria foto não depende do consentimento: é o que se faz ao desligá-lo.
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and private.avatar_owner(name) = (select auth.uid()));

-- RPCs ------------------------------------------------------------------------------------------

-- Liga ou desliga uma finalidade. Desligar a foto some com ela para os outros na mesma hora.
create function public.set_data_consent(p_purpose text, p_granted boolean)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
  v_at timestamptz;
begin
  if p_granted is null or p_purpose is null or p_purpose not in ('foto', 'localizacao') then
    raise exception 'invalid_consent' using errcode = 'P0001';
  end if;

  if private.recent_actions(v_user_id, null, 'consent.changed', interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  if p_purpose = 'foto' then
    if p_granted then
      update public.profiles as p
      set photo_consent_at = coalesce(p.photo_consent_at, now())
      where p.id = v_user_id
      returning p.photo_consent_at into v_at;
    else
      update public.profiles as p set photo_consent_at = null, avatar_updated_at = null where p.id = v_user_id;
    end if;
  else
    if p_granted then
      update public.profiles as p
      set location_consent_at = coalesce(p.location_consent_at, now())
      where p.id = v_user_id
      returning p.location_consent_at into v_at;
    else
      update public.profiles as p set location_consent_at = null where p.id = v_user_id;
    end if;
  end if;

  perform private.audit(v_user_id, 'consent.changed', null);
  return v_at;
end;
$$;

-- Marca a foto como trocada (depois do envio) ou removida. Só aceita foto que existe no bucket.
create function public.set_avatar(p_present boolean)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id constant uuid := private.require_profile();
  v_at timestamptz;
begin
  if p_present is null then
    raise exception 'invalid_avatar' using errcode = 'P0001';
  end if;

  if not p_present then
    update public.profiles as p set avatar_updated_at = null where p.id = v_user_id;
    return null;
  end if;

  if not exists (select 1 from public.profiles as p where p.id = v_user_id and p.photo_consent_at is not null) then
    raise exception 'photo_consent_required' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from storage.objects as o
    where o.bucket_id = 'avatars' and o.name = v_user_id::text || '/avatar.jpg'
  ) then
    raise exception 'avatar_not_uploaded' using errcode = 'P0001';
  end if;
  if private.recent_actions(v_user_id, null, 'photo.updated', interval '1 hour') >= 20 then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  update public.profiles as p set avatar_updated_at = now() where p.id = v_user_id returning p.avatar_updated_at into v_at;
  perform private.audit(v_user_id, 'photo.updated', null);
  return v_at;
end;
$$;

-- Quem da Legião tem foto, e de quando: o app pede as fotos só dessas pessoas.
create function public.legion_photos(p_group_id uuid)
returns table (user_id uuid, avatar_updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_profile();
  if not private.is_group_member(p_group_id) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  return query
    select p.id, p.avatar_updated_at
    from public.group_members as gm
    join public.profiles as p on p.id = gm.user_id
    where gm.group_id = p_group_id and p.photo_consent_at is not null and p.avatar_updated_at is not null;
end;
$$;

-- Privilégios ----------------------------------------------------------------------------------

revoke all on function private.avatar_owner(text) from public;
revoke all on function private.can_write_avatar(text) from public;
revoke all on function private.can_see_avatar(text) from public;
-- As regras do storage rodam como quem pede: precisam executar as três.
grant execute on function private.avatar_owner(text) to authenticated;
grant execute on function private.can_write_avatar(text) to authenticated;
grant execute on function private.can_see_avatar(text) to authenticated;

revoke all on function public.my_profile() from public, anon, authenticated;
grant execute on function public.my_profile() to authenticated;

revoke all on function public.set_data_consent(text, boolean) from public, anon, authenticated;
revoke all on function public.set_avatar(boolean) from public, anon, authenticated;
revoke all on function public.legion_photos(uuid) from public, anon, authenticated;
grant execute on function public.set_data_consent(text, boolean) to authenticated;
grant execute on function public.set_avatar(boolean) to authenticated;
grant execute on function public.legion_photos(uuid) to authenticated;
