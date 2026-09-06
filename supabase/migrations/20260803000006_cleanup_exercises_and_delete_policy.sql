-- Limpa entradas erradas da biblioteca de exercícios e libera exclusão de
-- exercícios "de sistema" (user_id null) pra qualquer usuário logado — antes só
-- o dono (ou admin) podia apagar, mas exercícios de sistema não têm dono, então
-- ninguém sem ser admin conseguia corrigir um nome duplicado/errado no catálogo
-- compartilhado.

-- ---------------------------------------------------------
-- Remove "Supino Ghigtt" (nome errado) por completo
-- ---------------------------------------------------------

delete from public.workout_exercises
where exercise_id in (
  select id from public.exercises where name ilike 'Supino Ghigtt'
);

delete from public.exercises where name ilike 'Supino Ghigtt';

-- ---------------------------------------------------------
-- Deduplica "Supino Inclinado no Smith" — mantém uma linha (preferindo a de
-- sistema), repontando treinos que já referenciavam as duplicatas antes de
-- apagá-las (exercise_id é "on delete restrict").
-- ---------------------------------------------------------

do $$
declare
  keep_id uuid;
begin
  select id into keep_id
  from public.exercises
  where name = 'Supino Inclinado no Smith'
  order by (user_id is null) desc, created_at asc
  limit 1;

  if keep_id is not null then
    update public.workout_exercises
    set exercise_id = keep_id
    where exercise_id in (
      select id from public.exercises
      where name = 'Supino Inclinado no Smith' and id <> keep_id
    );

    delete from public.exercises
    where name = 'Supino Inclinado no Smith' and id <> keep_id;
  end if;
end $$;

-- ---------------------------------------------------------
-- Policy: além do dono e do admin, qualquer usuário logado pode apagar um
-- exercício "de sistema" (user_id is null) — corrige erros no catálogo
-- compartilhado sem precisar de admin. Exercícios de OUTRO usuário continuam
-- protegidos.
-- ---------------------------------------------------------

drop policy if exists "exercises_delete_own" on public.exercises;
create policy "exercises_delete_own" on public.exercises
  for delete using (user_id = auth.uid() or user_id is null or public.is_admin());
