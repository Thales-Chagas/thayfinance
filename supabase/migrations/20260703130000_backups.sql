-- ============================================================
--  Thayfinance — Bucket privado para os backups automáticos
--  A Edge Function 'backup' grava aqui um JSON por usuário a cada 3 dias.
--  O agendamento (pg_cron) fica num passo à parte porque leva o segredo.
--  Cole no SQL Editor e clique em RUN. É idempotente.
-- ============================================================

-- Bucket PRIVADO (public=false): só a service_role (a função) escreve/lê.
-- O dono baixa os backups pelo painel (Storage) ou por signed URL.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;
