-- =========================================================
-- Mídia de demonstração do exercício (gif/vídeo/imagem)
-- =========================================================
-- Link opcional exibido durante o treino pra lembrar a execução correta.
-- Sem valor por padrão — preenchido manualmente exercício a exercício
-- conforme a academia for enviando os links.

alter table public.exercises
  add column if not exists demo_media_url text;
