-- Hosted Supabase security boundary for the single-owner Listenwrite cloud.
create table if not exists public.listenwrite_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  state_updated_at bigint not null default 0,
  revision bigint not null default 1,
  synced_at timestamptz not null default now()
);
alter table public.listenwrite_user_state enable row level security;
grant select, insert, update, delete on public.listenwrite_user_state to authenticated;
drop policy if exists listenwrite_select_owner_state on public.listenwrite_user_state;
drop policy if exists listenwrite_insert_owner_state on public.listenwrite_user_state;
drop policy if exists listenwrite_update_owner_state on public.listenwrite_user_state;
drop policy if exists listenwrite_delete_owner_state on public.listenwrite_user_state;
create policy listenwrite_select_owner_state on public.listenwrite_user_state for select to authenticated using (auth.uid() = user_id and auth.uid() = '77f92fe7-3e18-4fa3-a328-9761b06f3171'::uuid);
create policy listenwrite_insert_owner_state on public.listenwrite_user_state for insert to authenticated with check (auth.uid() = user_id and auth.uid() = '77f92fe7-3e18-4fa3-a328-9761b06f3171'::uuid);
create policy listenwrite_update_owner_state on public.listenwrite_user_state for update to authenticated using (auth.uid() = user_id and auth.uid() = '77f92fe7-3e18-4fa3-a328-9761b06f3171'::uuid) with check (auth.uid() = user_id and auth.uid() = '77f92fe7-3e18-4fa3-a328-9761b06f3171'::uuid);
create policy listenwrite_delete_owner_state on public.listenwrite_user_state for delete to authenticated using (auth.uid() = user_id and auth.uid() = '77f92fe7-3e18-4fa3-a328-9761b06f3171'::uuid);

create or replace function public.listenwrite_pull_state()
returns table(state jsonb, state_updated_at bigint, revision bigint, synced_at timestamptz)
language sql stable set search_path = public as $$
  select s.state, s.state_updated_at, s.revision, s.synced_at from public.listenwrite_user_state s
  where s.user_id = auth.uid() and auth.uid() = '77f92fe7-3e18-4fa3-a328-9761b06f3171'::uuid;
$$;

create or replace function public.listenwrite_reject_new_auth_users()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin raise exception 'Listenwrite signups are disabled'; end; $$;
drop trigger if exists listenwrite_block_new_auth_users on auth.users;
create trigger listenwrite_block_new_auth_users before insert on auth.users for each row execute function public.listenwrite_reject_new_auth_users();
