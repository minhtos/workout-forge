-- One row per user holding their training program: the current block (plan and progress),
-- their own exercises, and the exercises they turned off in the library.
-- Logged sets are backed up separately in completed_workout_sessions.
create table public.user_programs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null,
  schema_version smallint not null default 1 check (schema_version = 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);

alter table public.user_programs enable row level security;

revoke all on public.user_programs from anon, authenticated;
grant select, insert, update on public.user_programs to authenticated;

create policy "read own program" on public.user_programs
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "insert own program" on public.user_programs
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "update own program" on public.user_programs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
