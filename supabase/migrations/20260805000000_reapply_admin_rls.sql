-- =========================================================
-- Reaplica (idempotente) as policies de RLS que dão ao super admin
-- acesso de leitura/edição aos dados de qualquer usuário.
-- Seguro rodar mais de uma vez: sempre derruba a policy antes de recriar.
-- =========================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- exercises (update/delete por admin)
drop policy if exists "exercises_update_own" on public.exercises;
create policy "exercises_update_own" on public.exercises
  for update using (user_id = auth.uid() or public.is_admin());
drop policy if exists "exercises_delete_own" on public.exercises;
create policy "exercises_delete_own" on public.exercises
  for delete using (user_id = auth.uid() or user_id is null or public.is_admin());

-- workouts
drop policy if exists "workouts_all_own" on public.workouts;
drop policy if exists "workouts_all_own_or_admin" on public.workouts;
create policy "workouts_all_own_or_admin" on public.workouts
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- workout_days
drop policy if exists "workout_days_all_own" on public.workout_days;
drop policy if exists "workout_days_all_own_or_admin" on public.workout_days;
create policy "workout_days_all_own_or_admin" on public.workout_days
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- workout_exercises (acesso via dono do workout pai, ou admin)
drop policy if exists "workout_exercises_select_own" on public.workout_exercises;
create policy "workout_exercises_select_own" on public.workout_exercises
  for select using (
    public.is_admin() or exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "workout_exercises_insert_own" on public.workout_exercises;
create policy "workout_exercises_insert_own" on public.workout_exercises
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "workout_exercises_update_own" on public.workout_exercises;
create policy "workout_exercises_update_own" on public.workout_exercises
  for update using (
    public.is_admin() or exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "workout_exercises_delete_own" on public.workout_exercises;
create policy "workout_exercises_delete_own" on public.workout_exercises
  for delete using (
    public.is_admin() or exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );

-- workout_sessions
drop policy if exists "workout_sessions_all_own" on public.workout_sessions;
drop policy if exists "workout_sessions_all_own_or_admin" on public.workout_sessions;
create policy "workout_sessions_all_own_or_admin" on public.workout_sessions
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- session_sets (acesso via dono da sessão pai, ou admin)
drop policy if exists "session_sets_select_own" on public.session_sets;
create policy "session_sets_select_own" on public.session_sets
  for select using (
    public.is_admin() or exists (
      select 1 from public.workout_sessions s
      where s.id = session_sets.session_id and s.user_id = auth.uid()
    )
  );
drop policy if exists "session_sets_insert_own" on public.session_sets;
create policy "session_sets_insert_own" on public.session_sets
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.workout_sessions s
      where s.id = session_sets.session_id and s.user_id = auth.uid()
    )
  );
drop policy if exists "session_sets_update_own" on public.session_sets;
create policy "session_sets_update_own" on public.session_sets
  for update using (
    public.is_admin() or exists (
      select 1 from public.workout_sessions s
      where s.id = session_sets.session_id and s.user_id = auth.uid()
    )
  );
drop policy if exists "session_sets_delete_own" on public.session_sets;
create policy "session_sets_delete_own" on public.session_sets
  for delete using (
    public.is_admin() or exists (
      select 1 from public.workout_sessions s
      where s.id = session_sets.session_id and s.user_id = auth.uid()
    )
  );

-- diet_entries
drop policy if exists "diet_entries_all_own_or_admin" on public.diet_entries;
create policy "diet_entries_all_own_or_admin" on public.diet_entries
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- water_logs
drop policy if exists "water_logs_all_own_or_admin" on public.water_logs;
create policy "water_logs_all_own_or_admin" on public.water_logs
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- body_weight_logs
drop policy if exists "body_weight_logs_all_own" on public.body_weight_logs;
drop policy if exists "body_weight_logs_all_own_or_admin" on public.body_weight_logs;
create policy "body_weight_logs_all_own_or_admin" on public.body_weight_logs
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- body_measurements
drop policy if exists "body_measurements_all_own" on public.body_measurements;
drop policy if exists "body_measurements_all_own_or_admin" on public.body_measurements;
create policy "body_measurements_all_own_or_admin" on public.body_measurements
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Confirma o resultado: lista as policies que mencionam is_admin()
select tablename, policyname
from pg_policies
where schemaname = 'public' and qual ilike '%is_admin%'
order by tablename, policyname;
