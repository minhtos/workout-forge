create table public.completed_workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  schema_version smallint not null default 1 check (schema_version = 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);

create index completed_workout_sessions_owner_completed_at_idx
  on public.completed_workout_sessions (user_id, completed_at desc, id);

alter table public.completed_workout_sessions enable row level security;

revoke all on public.completed_workout_sessions from anon;
grant select, insert on public.completed_workout_sessions to authenticated;

create policy "read own completed sessions" on public.completed_workout_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "insert own completed sessions" on public.completed_workout_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
