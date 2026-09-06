-- Persiste o "Feito" marcado por exercício no formulário de treino — hoje esse
-- estado só existia na tela (sempre resetava pra false ao reabrir o treino).
alter table public.workout_exercises
  add column if not exists done boolean not null default false;
