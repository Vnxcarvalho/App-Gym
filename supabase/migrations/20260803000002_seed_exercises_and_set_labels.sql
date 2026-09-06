-- Semeia o catálogo padrão de exercícios (user_id = null → sistema, visível a
-- todos via a policy de biblioteca compartilhada) e adiciona uma coluna pra
-- guardar o rótulo customizado de cada série ("Aquecimento" etc.), em paralelo
-- ao target_reps (mesma posição = mesma série).

-- índice único parcial só entre os exercícios "de sistema" (user_id null),
-- pra permitir rodar essa seed mais de uma vez sem duplicar linhas
create unique index if not exists exercises_system_name_unique
  on public.exercises (name)
  where user_id is null;

insert into public.exercises (name, muscle_group, equipment)
select * from unnest(
  array['Agachamento Livre','Leg Press 45°','Cadeira Extensora','Stiff com Barra','Supino Reto','Supino Inclinado','Crucifixo','Puxada Alta','Remada Curvada','Remada Baixa','Desenvolvimento Militar','Elevação Lateral','Rosca Direta','Tríceps Corda','Panturrilha em Pé','Abdominal Supra']::text[],
  array['legs','legs','legs','legs','chest','chest','chest','back','back','back','shoulders','shoulders','biceps','triceps','calves','abs']::muscle_group[],
  array['barbell','machine','machine','barbell','barbell','dumbbell','dumbbell','cable','barbell','cable','barbell','dumbbell','barbell','cable','machine','bodyweight']::equipment_type[]
)
on conflict (name) where user_id is null do nothing;

alter table public.workout_exercises
  add column if not exists set_labels text[] not null default '{}';
