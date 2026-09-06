-- =========================================================
-- Novo grupo muscular: "Posterior de Coxa" (isquiotibiais)
-- =========================================================
-- Antes, treino de posterior era classificado como "legs" (rotulado
-- "Quadríceps" no app). Agora vira um grupo próprio pra separar
-- quadríceps de posterior nos treinos e na progressão de carga.

alter type public.muscle_group add value if not exists 'hamstrings' after 'legs';
