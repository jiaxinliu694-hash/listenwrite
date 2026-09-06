-- Per-owner capability digests. Provision real random keys separately; never
-- put real keys, sessions or passwords in source or migration files.
create table public.listenwrite_direct_keys (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Personal sync link',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz
);
alter table public.listenwrite_direct_keys enable row level security;
revoke all on public.listenwrite_direct_keys from public, anon, authenticated;
create index listenwrite_direct_keys_user_idx on public.listenwrite_direct_keys(user_id);

create function public.listenwrite_direct_owner(p_sync_key text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if p_sync_key is null or p_sync_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Direct sync link unavailable' using errcode='42501';
  end if;
  select k.user_id into v_uid from public.listenwrite_direct_keys k
    where k.key_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_sync_key,'UTF8')),'hex')
      and k.revoked_at is null and (k.expires_at is null or k.expires_at > now());
  if v_uid is null then raise exception 'Direct sync link unavailable' using errcode='42501'; end if;
  return v_uid;
end $$;
revoke all on function public.listenwrite_direct_owner(text) from public, anon, authenticated;

create function public.listenwrite_direct_connect(p_sync_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object('user_id', public.listenwrite_direct_owner(p_sync_key), 'connected', true);
$$;
revoke all on function public.listenwrite_direct_connect(text) from public;
grant execute on function public.listenwrite_direct_connect(text) to anon, authenticated;

create function public.listenwrite_direct_pull(p_sync_key text)
returns table(state jsonb, state_updated_at bigint, revision bigint, synced_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.listenwrite_direct_owner(p_sync_key);
begin
  return query select s.state, s.state_updated_at, s.revision, s.synced_at
    from public.listenwrite_user_state s where s.user_id=v_uid;
end $$;
revoke all on function public.listenwrite_direct_pull(text) from public;
grant execute on function public.listenwrite_direct_pull(text) to anon, authenticated;

create function public.listenwrite_direct_push(p_sync_key text, p_state jsonb, p_state_updated_at bigint, p_expected_revision bigint)
returns table(status text, cloud_state jsonb, cloud_updated_at bigint, revision bigint, synced_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.listenwrite_direct_owner(p_sync_key);
  v_row public.listenwrite_user_state%rowtype;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object'
    or jsonb_typeof(p_state->'words') is distinct from 'array'
    or jsonb_typeof(p_state->'events') is distinct from 'array'
    or octet_length(p_state::text) > 20971520 then
    raise exception 'Invalid learning state' using errcode='22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Expected revision is required' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 48));
  select * into v_row from public.listenwrite_user_state s where s.user_id=v_uid for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'Cloud state changed' using errcode='40001'; end if;
    insert into public.listenwrite_user_state(user_id,state,state_updated_at,revision,synced_at)
      values(v_uid,p_state,greatest(coalesce(p_state_updated_at,0),0),1,now()) returning * into v_row;
    return query select 'created'::text,v_row.state,v_row.state_updated_at,v_row.revision,v_row.synced_at;
    return;
  end if;
  if v_row.revision <> p_expected_revision then
    return query select 'conflict'::text,v_row.state,v_row.state_updated_at,v_row.revision,v_row.synced_at;
    return;
  end if;
  update public.listenwrite_user_state s set state=p_state,
    state_updated_at=greatest(coalesce(p_state_updated_at,0),0), revision=s.revision+1, synced_at=now()
    where s.user_id=v_uid returning s.* into v_row;
  return query select 'updated'::text,v_row.state,v_row.state_updated_at,v_row.revision,v_row.synced_at;
end $$;
revoke all on function public.listenwrite_direct_push(text,jsonb,bigint,bigint) from public;
grant execute on function public.listenwrite_direct_push(text,jsonb,bigint,bigint) to anon, authenticated;
comment on table public.listenwrite_direct_keys is 'Revocable per-owner capability digests for private no-prompt sync links. Never grant table access to clients.';
notify pgrst, 'reload schema';
