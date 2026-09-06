-- =========================================================
-- Dieta, meta de água e papel de super admin
-- =========================================================

-- ---------------------------------------------------------
-- PROFILES: papel (role) e meta diária de água
-- ---------------------------------------------------------

alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin')),
  add column water_goal_ml integer not null default 2000 check (water_goal_ml > 0);

-- Promove a conta do super admin automaticamente, se já existir.
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'alanviniciuscarvalho@gmail.com');

-- Cadastros futuros com esse e-mail também entram como admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'Usuário'),
    case when new.email = 'alanviniciuscarvalho@gmail.com' then 'admin' else 'user' end
  );
  return new;
end;
$$;

-- ---------------------------------------------------------
-- is_admin(): helper security definer — evita recursão de RLS
-- ao checar o papel do usuário logado dentro das próprias policies.
-- ---------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------
-- MEAL_TYPE
-- ---------------------------------------------------------

create type meal_type as enum (
  'cafe_da_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia', 'outro'
);

-- ---------------------------------------------------------
-- DIET_ENTRIES (refeições registradas por dia)
-- ---------------------------------------------------------

create table public.diet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_at date not null default current_date,
  meal_type meal_type not null default 'outro',
  name text not null,
  calories integer check (calories >= 0),
  protein_g numeric(6, 2) check (protein_g >= 0),
  carbs_g numeric(6, 2) check (carbs_g >= 0),
  created_at timestamptz not null default now()
);

create index diet_entries_user_id_idx on public.diet_entries (user_id);
create index diet_entries_logged_at_idx on public.diet_entries (logged_at desc);

alter table public.diet_entries enable row level security;

create policy "diet_entries_all_own_or_admin" on public.diet_entries
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------
-- WATER_LOGS (cada registro é um "gole"/adição — soma do dia = total)
-- ---------------------------------------------------------

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_at date not null default current_date,
  amount_ml integer not null check (amount_ml > 0),
  created_at timestamptz not null default now()
);

create index water_logs_user_id_idx on public.water_logs (user_id);
create index water_logs_logged_at_idx on public.water_logs (logged_at desc);

alter table public.water_logs enable row level security;

create policy "water_logs_all_own_or_admin" on public.water_logs
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- =========================================================
-- Acesso do super admin às demais tabelas
-- =========================================================

-- profiles: admin vê e edita todos os perfis (lista de usuários do painel admin)
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- exercises: admin também pode editar/apagar exercícios de qualquer usuário
drop policy if exists "exercises_update_own" on public.exercises;
create policy "exercises_update_own" on public.exercises
  for update using (user_id = auth.uid() or public.is_admin());
drop policy if exists "exercises_delete_own" on public.exercises;
create policy "exercises_delete_own" on public.exercises
  for delete using (user_id = auth.uid() or public.is_admin());

-- workouts
drop policy if exists "workouts_all_own" on public.workouts;
create policy "workouts_all_own_or_admin" on public.workouts
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- workout_days
drop policy if exists "workout_days_all_own" on public.workout_days;
create policy "workout_days_all_own_or_admin" on public.workout_days
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- workout_exercises: acesso via dono do workout pai (ou admin)
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
create policy "workout_sessions_all_own_or_admin" on public.workout_sessions
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- session_sets: acesso via dono da sessão pai (ou admin)
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

-- body_weight_logs
drop policy if exists "body_weight_logs_all_own" on public.body_weight_logs;
create policy "body_weight_logs_all_own_or_admin" on public.body_weight_logs
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- body_measurements
drop policy if exists "body_measurements_all_own" on public.body_measurements;
create policy "body_measurements_all_own_or_admin" on public.body_measurements
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
