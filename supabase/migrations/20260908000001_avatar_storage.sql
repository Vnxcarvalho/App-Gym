-- =========================================================
-- Storage de fotos de perfil (avatars)
-- =========================================================
-- Bucket público (a foto de perfil não é dado sensível — mesma lógica de
-- qualquer app que expõe avatar por URL direta). Caminho dos arquivos é
-- "<user_id>/avatar.jpg", então a policy de escrita usa o primeiro segmento
-- do path pra garantir que cada um só escreve na própria pasta (ou admin,
-- reaproveitando public.is_admin() já usado nas outras tabelas).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own_or_admin" on storage.objects;
create policy "avatars_insert_own_or_admin" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

drop policy if exists "avatars_update_own_or_admin" on storage.objects;
create policy "avatars_update_own_or_admin" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

drop policy if exists "avatars_delete_own_or_admin" on storage.objects;
create policy "avatars_delete_own_or_admin" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );
