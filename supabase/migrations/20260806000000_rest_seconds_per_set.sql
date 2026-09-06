-- Tempo de descanso editável por série (cronômetro que dispara ao marcar
-- "feito"). Mesmo padrão de target_reps/target_weight_kg/set_labels: um
-- array por workout_exercise, uma posição por série.
alter table public.workout_exercises
  add column if not exists rest_seconds integer[] not null default '{}';
