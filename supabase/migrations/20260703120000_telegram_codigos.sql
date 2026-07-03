-- ============================================================
--  Thayfinance — Conexão self-service do Telegram
--  O app gera um código de 6 números; a pessoa manda "/conectar 123456"
--  no bot; a Edge Function valida o código e cria o vínculo em
--  telegram_links (chat_id -> user_id) sozinha — sem SQL manual.
--  Cole no SQL Editor do Supabase e clique em RUN. É idempotente.
-- ============================================================

-- Códigos temporários de pareamento (1 código ativo por conta).
--   codigo    = 6 dígitos que a pessoa digita no bot
--   user_id   = dono do código (quem está logado no app)
--   expira_em = validade curta (o app grava agora + 15 min)
create table if not exists public.telegram_codigos (
  codigo      text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  nome        text,
  expira_em   timestamptz not null,
  created_at  timestamptz not null default now()
);

-- índice para limpar os expirados e achar por usuário
create index if not exists telegram_codigos_user_idx on public.telegram_codigos(user_id);
create index if not exists telegram_codigos_expira_idx on public.telegram_codigos(expira_em);

-- RLS: cada pessoa só cria/vê/apaga o PRÓPRIO código.
-- (A Edge Function usa a service_role e passa por cima da RLS pra validar o
--  código de qualquer um na hora do /conectar — é o backend confiável.)
alter table public.telegram_codigos enable row level security;
drop policy if exists "tgcod_dono_all" on public.telegram_codigos;
create policy "tgcod_dono_all" on public.telegram_codigos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
