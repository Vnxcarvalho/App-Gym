-- Meta de repetição passa a ser por série individual (array), permitindo esquemas
-- piramidais (ex: 12, 10, 8) em vez de um único "X séries de Y reps" combinado.
-- O número de séries agora é implícito: array_length(target_reps, 1).
--
-- Sem dado real para preservar ainda (tabela nova, ninguém gravou workout_exercises
-- de verdade), então troca direto em vez de escrever uma conversão do formato antigo.

alter table public.workout_exercises drop column if exists target_sets;
alter table public.workout_exercises drop column if exists target_reps;
alter table public.workout_exercises add column if not exists target_reps smallint[] not null default '{12,12,12}';
