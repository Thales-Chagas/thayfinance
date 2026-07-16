-- ============================================================
--  Thayfinance — Recorrência de lançamentos (contas a pagar/receber)
--  Guarda a regra da série em cada lançamento gerado, ex.:
--    { "grupo": "<uuid da série>", "tipo": "mensal", "cada": null,
--      "inicio": "2026-08-10", "fim": null, "n": 3 }
--  tipo: diaria | semanal | quinzenal | mensal | bimestral | trimestral
--        | semestral | anual | dias (personalizada, a cada `cada` dias)
--  fim = null significa "sem término" (o app renova a série sozinho).
--  Cole no SQL Editor do Supabase e clique em RUN. É idempotente.
--  (Enquanto não rodar, o app funciona igual — os lançamentos gerados
--   sobem normalmente, só a regra da série não persiste na nuvem;
--   ele detecta a coluna ausente e salva sem ela.)
-- ============================================================

alter table public.transacoes add column if not exists recorrencia jsonb;
