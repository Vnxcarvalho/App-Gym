-- Permite ao super admin excluir o perfil de um usuário. Não existia nenhuma
-- policy de delete em profiles até agora (nem o próprio dono podia se
-- auto-excluir por aqui) — só o admin ganha essa permissão.
--
-- profiles.id referencia auth.users(id) on delete cascade, mas aqui é o
-- INVERSO: apagar a linha de profiles não apaga auth.users (a credencial de
-- login continua existindo no Supabase Auth). O que cascade automaticamente
-- ao apagar profiles são as tabelas que referenciam profiles(id) on delete
-- cascade: exercises, workouts (e por tabela workout_days/workout_exercises/
-- workout_sessions/session_sets em cascata), body_weight_logs,
-- body_measurements, diet_entries, water_logs — todo o histórico do usuário
-- some junto.

create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());
