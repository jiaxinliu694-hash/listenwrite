-- Schema only: no live capability is provisioned by this migration.
-- Registration accepts only a digest from an already authenticated owner.
create function public.listenwrite_register_device_entry(p_key_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.listenwrite_direct_keys%rowtype;
begin
  if v_uid is null or auth.role() is distinct from 'authenticated'
    or lower(coalesce(auth.jwt()->>'email','')) <> 'jiaxinliu694@gmail.com'
    or not exists (select 1 from public.listenwrite_user_state s where s.user_id=v_uid) then
    raise exception 'Existing owner session required' using errcode='42501';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid entry digest' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,49));
  select * into v_existing from public.listenwrite_direct_keys k where k.key_hash=p_key_hash;
  if found then
    if v_existing.user_id is distinct from v_uid or v_existing.revoked_at is not null
      or (v_existing.expires_at is not null and v_existing.expires_at <= now()) then
      raise exception 'Entry unavailable' using errcode='42501';
    end if;
  else
    if (select count(*) from public.listenwrite_direct_keys k where k.user_id=v_uid
        and k.revoked_at is null and (k.expires_at is null or k.expires_at>now())) >= 20 then
      raise exception 'Too many active device entries' using errcode='54000';
    end if;
    insert into public.listenwrite_direct_keys(key_hash,user_id,label)
      values(p_key_hash,v_uid,'Created by signed-in owner device');
  end if;
  return pg_catalog.jsonb_build_object('registered',true,'user_id',v_uid,'key_hash',p_key_hash);
end $$;
revoke all on function public.listenwrite_register_device_entry(text) from public, anon;
grant execute on function public.listenwrite_register_device_entry(text) to authenticated;

create function public.listenwrite_revoke_device_entry(p_key_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or auth.role() is distinct from 'authenticated'
    or lower(coalesce(auth.jwt()->>'email','')) <> 'jiaxinliu694@gmail.com'
    or not exists (select 1 from public.listenwrite_user_state s where s.user_id=v_uid) then
    raise exception 'Existing owner session required' using errcode='42501';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid entry digest' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,49));
  update public.listenwrite_direct_keys k set revoked_at=coalesce(k.revoked_at,now())
    where k.user_id=v_uid and k.key_hash=p_key_hash;
  return pg_catalog.jsonb_build_object('revoked',true,'user_id',v_uid,'key_hash',p_key_hash);
end $$;
revoke all on function public.listenwrite_revoke_device_entry(text) from public, anon;
grant execute on function public.listenwrite_revoke_device_entry(text) to authenticated;
notify pgrst, 'reload schema';
