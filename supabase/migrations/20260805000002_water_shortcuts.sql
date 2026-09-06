-- Atalhos de água configuráveis (ex: "500ml", "1L") — antes a tela só mostrava
-- copos fixos de 250ml calculados a partir da meta. Guardado como jsonb em
-- profiles porque é só uma lista curta de preferência do usuário, não histórico.
alter table public.profiles
  add column if not exists water_shortcuts jsonb not null default '[
    {"label": "250ml", "amountMl": 250},
    {"label": "500ml", "amountMl": 500},
    {"label": "1L", "amountMl": 1000}
  ]'::jsonb;
