-- =========================================================
-- Gym Tracker — Schema inicial
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------

create type muscle_group as enum (
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'legs', 'glutes', 'calves', 'abs', 'cardio', 'full_body'
);

create type equipment_type as enum (
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'
);

create type measurement_type as enum (
  'waist', 'chest', 'hip', 'arm_left', 'arm_right',
  'thigh_left', 'thigh_right', 'calf_left', 'calf_right', 'neck', 'shoulders'
);

-- ---------------------------------------------------------
-- PROFILES (extensão de auth.users)
-- ---------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  height_cm numeric(5, 2),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cria o profile automaticamente quando um usuário se cadastra no Supabase Auth
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', 'Usuário'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- EXERCISES (catálogo global + custom por usuário)
-- ---------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade, -- null = exercício padrão do sistema
  name text not null,
  muscle_group muscle_group not null,
  equipment equipment_type not null default 'other',
  video_url text,
  created_at timestamptz not null default now()
);

create index exercises_user_id_idx on public.exercises (user_id);
create index exercises_muscle_group_idx on public.exercises (muscle_group);

-- ---------------------------------------------------------
-- WORKOUTS (templates de treino, ex: "Treino A")
-- ---------------------------------------------------------

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  muscle_groups muscle_group[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workouts_user_id_idx on public.workouts (user_id);

-- ---------------------------------------------------------
-- WORKOUT_DAYS (vínculo treino <-> dia da semana)
-- ---------------------------------------------------------

create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete cascade, -- null = dia de descanso
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo ... 6 = sábado
  active boolean not null default true,
  created_at timestamptz not null default now(),

  unique (user_id, weekday)
);

create index workout_days_user_id_idx on public.workout_days (user_id);

-- ---------------------------------------------------------
-- WORKOUT_EXERCISES (exercícios dentro de um treino, com metas)
-- ---------------------------------------------------------

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  target_sets smallint not null default 3,
  target_reps text not null default '8-12', -- string p/ suportar faixas ("8-12") ou fixo ("10")
  order_index smallint not null default 0,
  created_at timestamptz not null default now()
);

create index workout_exercises_workout_id_idx on public.workout_exercises (workout_id);
create index workout_exercises_exercise_id_idx on public.workout_exercises (exercise_id);

-- ---------------------------------------------------------
-- WORKOUT_SESSIONS (execução real de um treino)
-- ---------------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text
);

create index workout_sessions_user_id_idx on public.workout_sessions (user_id);
create index workout_sessions_workout_id_idx on public.workout_sessions (workout_id);
create index workout_sessions_started_at_idx on public.workout_sessions (started_at desc);

-- ---------------------------------------------------------
-- SESSION_SETS (séries realmente executadas — histórico de carga)
-- ---------------------------------------------------------

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number smallint not null,
  weight_kg numeric(6, 2) not null,
  reps smallint not null,
  rpe numeric(3, 1) check (rpe between 0 and 10),
  created_at timestamptz not null default now()
);

create index session_sets_session_id_idx on public.session_sets (session_id);
create index session_sets_workout_exercise_id_idx on public.session_sets (workout_exercise_id);

-- ---------------------------------------------------------
-- BODY_WEIGHT_LOGS (evolução de peso corporal)
-- ---------------------------------------------------------

create table public.body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  weight_kg numeric(5, 2) not null,
  logged_at date not null default current_date,
  note text,
  created_at timestamptz not null default now(),

  unique (user_id, logged_at)
);

create index body_weight_logs_user_id_idx on public.body_weight_logs (user_id);
create index body_weight_logs_logged_at_idx on public.body_weight_logs (logged_at desc);

-- ---------------------------------------------------------
-- BODY_MEASUREMENTS (opcional — circunferências)
-- ---------------------------------------------------------

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type measurement_type not null,
  value_cm numeric(5, 2) not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index body_measurements_user_id_idx on public.body_measurements (user_id);

-- ---------------------------------------------------------
-- updated_at automático em profiles / workouts
-- ---------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_workouts_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_sets enable row level security;
alter table public.body_weight_logs enable row level security;
alter table public.body_measurements enable row level security;

-- profiles: cada usuário só vê/edita o próprio perfil
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- exercises: vê exercícios do sistema (user_id null) + os próprios; só edita/cria/apaga os próprios
create policy "exercises_select" on public.exercises
  for select using (user_id is null or user_id = auth.uid());
create policy "exercises_insert_own" on public.exercises
  for insert with check (user_id = auth.uid());
create policy "exercises_update_own" on public.exercises
  for update using (user_id = auth.uid());
create policy "exercises_delete_own" on public.exercises
  for delete using (user_id = auth.uid());

-- workouts
create policy "workouts_all_own" on public.workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- workout_days
create policy "workout_days_all_own" on public.workout_days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- workout_exercises: acesso via dono do workout pai
create policy "workout_exercises_select_own" on public.workout_exercises
  for select using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );
create policy "workout_exercises_insert_own" on public.workout_exercises
  for insert with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );
create policy "workout_exercises_update_own" on public.workout_exercises
  for update using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );
create policy "workout_exercises_delete_own" on public.workout_exercises
  for delete using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );

-- workout_sessions
create policy "workout_sessions_all_own" on public.workout_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- session_sets: acesso via dono da sessão pai
create policy "session_sets_select_own" on public.session_sets
  for select using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_sets.session_id and s.user_id = auth.uid()
    )
  );
create policy "session_sets_insert_own" on public.session_sets
  for insert with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_sets.session_id and s.user_id = auth.uid()
    )
  );
create policy "session_sets_update_own" on public.session_sets
  for update using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_sets.session_id and s.user_id = auth.uid()
    )
  );
create policy "session_sets_delete_own" on public.session_sets
  for delete using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_sets.session_id and s.user_id = auth.uid()
    )
  );

-- body_weight_logs
create policy "body_weight_logs_all_own" on public.body_weight_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- body_measurements
create policy "body_measurements_all_own" on public.body_measurements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
