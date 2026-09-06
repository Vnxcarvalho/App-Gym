-- Exercícios criados por um usuário passam a ser visíveis para todos os usuários
-- (biblioteca compartilhada) — antes cada um só via os próprios + os padrão do sistema.
-- Escrita (insert/update/delete) continua restrita ao dono do exercício.

drop policy if exists "exercises_select" on public.exercises;

create policy "exercises_select" on public.exercises
  for select using (true);
