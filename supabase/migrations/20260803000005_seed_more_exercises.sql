-- Amplia o catálogo padrão de exercícios com os itens usados nos treinos reais
-- do usuário (puxar/empurrar/pernas + glúteo). Reaproveita o índice único
-- parcial (name where user_id is null) da seed anterior — roda mais de uma
-- vez sem duplicar. Itens que já existiam no catálogo (Crucifixo, Elevação
-- Lateral, Remada Curvada, Puxada Alta, Agachamento Livre, Cadeira Extensora,
-- Stiff, Panturrilha em Pé, Leg Press 45°, Supino Reto) foram propositalmente
-- deixados de fora — já cobrem o mesmo exercício.

insert into public.exercises (name, muscle_group, equipment)
select * from unnest(
  array[
    'Supino Inclinado no Smith','Desenvolvimento com Halter','Cadeira Adutora',
    'RDL (Levantamento Romeno)','Cadeira Flexora','Desenvolvimento no Smith',
    'Supino Reto com Halter','Crucifixo Inclinado na Polia','Cadeira Abdutora',
    'Mesa Flexora','Flexor Unilateral',
    'Elevação Pélvica','Adução de Glúteo na Polia','Coice na Polia'
  ]::text[],
  array[
    'chest','shoulders','legs',
    'legs','legs','shoulders',
    'chest','chest','legs',
    'legs','legs',
    'glutes','glutes','glutes'
  ]::muscle_group[],
  array[
    'machine','dumbbell','machine',
    'barbell','machine','machine',
    'dumbbell','cable','machine',
    'machine','machine',
    'barbell','cable','cable'
  ]::equipment_type[]
)
on conflict (name) where user_id is null do nothing;
