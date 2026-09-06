-- Carga alvo (kg) por série individual, em paralelo a target_reps e set_labels
-- (mesma posição no array = mesma série).

alter table public.workout_exercises
  add column if not exists target_weight_kg numeric(6, 2)[] not null default '{20,20,20}';
