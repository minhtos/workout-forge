-- Public feedback notes from the landing page and Settings.
-- Insert-only by design: anyone (signed in or not) can leave a note, and no
-- app role can read, update or delete them. Notes are read in the Supabase
-- dashboard (SQL editor / table editor), which bypasses row level security.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) between 3 and 2000),
  email text check (email is null or char_length(email) <= 320),
  user_id uuid references auth.users(id) on delete set null
);

alter table public.feedback enable row level security;

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;

-- Anonymous visitors may only attach no account; signed-in users may only
-- attach their own account id (or none).
create policy "leave a note (anonymous)" on public.feedback
  for insert to anon with check (user_id is null);

create policy "leave a note (signed in)" on public.feedback
  for insert to authenticated with check (user_id is null or user_id = (select auth.uid()));
