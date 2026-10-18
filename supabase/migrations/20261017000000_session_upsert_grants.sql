-- The app saves a session with an upsert (INSERT ... ON CONFLICT (id) DO UPDATE). Postgres requires UPDATE on every
-- column the statement sets: id, user_id, completed_at, schema_version and payload. Only completed_at and payload were
-- granted, so any session whose row already existed failed with "permission denied for table completed_workout_sessions"
-- and only a session's very first set was ever backed up.
-- Row level security still applies: the update policy checks user_id = auth.uid() both before and after the change, so
-- nobody can touch another user's row or hand a row to someone else.
grant update (id, user_id, completed_at, schema_version, payload) on public.completed_workout_sessions to authenticated;

-- Hygiene: the app never needs these, and TRUNCATE is not covered by row level security.
revoke truncate, references, trigger on public.completed_workout_sessions from authenticated;
