-- Sets are now saved as they are logged, so a session row is rewritten after every set
-- (upsert) and removed if the session ends up with no sets (discard / undo).
revoke update on public.completed_workout_sessions from authenticated;
grant update (completed_at, payload) on public.completed_workout_sessions to authenticated;
grant delete on public.completed_workout_sessions to authenticated;

create policy "update own completed sessions" on public.completed_workout_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own completed sessions" on public.completed_workout_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);
