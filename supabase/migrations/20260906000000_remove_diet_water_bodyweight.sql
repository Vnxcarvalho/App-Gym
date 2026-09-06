-- =========================================================
-- Remove os módulos de Dieta (refeições), Água e Peso corporal
-- =========================================================
-- O app deixou de ter a aba "Dieta" e o registro de peso corporal.
-- Esta migration derruba as tabelas, o tipo e as colunas de perfil
-- que davam suporte a esses recursos. As policies de RLS caem junto
-- com as tabelas (DROP TABLE ... CASCADE).

drop table if exists public.diet_entries cascade;
drop table if exists public.water_logs cascade;
drop table if exists public.body_weight_logs cascade;

drop type if exists public.meal_type;

alter table public.profiles
  drop column if exists water_goal_ml,
  drop column if exists water_shortcuts;
