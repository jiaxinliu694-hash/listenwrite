create or replace function public.listenwrite_push_state(
  p_state jsonb,
  p_state_updated_at bigint,
  p_expected_revision bigint default null
)
returns table(
  status text,
  cloud_state jsonb,
  cloud_updated_at bigint,
  revision bigint,
  synced_at timestamptz
)
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.listenwrite_user_state%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if v_uid <> '77f92fe7-3e18-4fa3-a328-9761b06f3171'::uuid then
    raise exception 'this Listenwrite cloud is private' using errcode = '42501';
  end if;

  select * into v_row
  from public.listenwrite_user_state as s
  where s.user_id = v_uid
  for update;

  if not found then
    insert into public.listenwrite_user_state(user_id, state, state_updated_at, revision, synced_at)
    values (v_uid, p_state, greatest(coalesce(p_state_updated_at, 0), 0), 1, now())
    returning * into v_row;
    return query select 'created'::text, v_row.state, v_row.state_updated_at, v_row.revision, v_row.synced_at;
    return;
  end if;

  if p_expected_revision is not null and v_row.revision <> p_expected_revision then
    return query select 'conflict'::text, v_row.state, v_row.state_updated_at, v_row.revision, v_row.synced_at;
    return;
  end if;

  if p_expected_revision is null and v_row.state_updated_at > coalesce(p_state_updated_at, 0) then
    return query select 'conflict'::text, v_row.state, v_row.state_updated_at, v_row.revision, v_row.synced_at;
    return;
  end if;

  update public.listenwrite_user_state as s
  set state = p_state,
      state_updated_at = greatest(coalesce(p_state_updated_at, 0), 0),
      revision = s.revision + 1,
      synced_at = now()
  where s.user_id = v_uid
  returning s.* into v_row;

  return query select 'updated'::text, v_row.state, v_row.state_updated_at, v_row.revision, v_row.synced_at;
end;
$$;
