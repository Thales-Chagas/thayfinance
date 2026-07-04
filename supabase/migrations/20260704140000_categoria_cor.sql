-- ============================================================
--  Thayfinance — Cor (gradiente) por categoria
--  Guarda o id do gradiente escolhido no app (ex.: 'oceano', 'rosa').
--  Sem valor = o app escolhe sozinho pelo nome da categoria.
--  Cole no SQL Editor do Supabase e clique em RUN. É idempotente.
--  (Enquanto não rodar, o app funciona igual — só não persiste a cor
--   escolhida na nuvem; ele detecta a coluna ausente e salva sem ela.)
-- ============================================================

alter table public.categorias add column if not exists cor text;
