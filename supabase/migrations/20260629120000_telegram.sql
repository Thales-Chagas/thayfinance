-- ============================================================
--  Thayfinance — Telegram (allowlist chat_id -> usuário)
--  Substitui a entrada por WhatsApp (que exigia verificação de empresa).
--  Cole no SQL Editor do Supabase e clique em RUN. É idempotente.
-- ============================================================

-- 1) Mapa/allowlist: só chat_ids cadastrados aqui são atendidos pelo bot.
create table if not exists public.telegram_links (
  chat_id        bigint primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  nome           text,
  verificado_em  timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table public.telegram_links enable row level security;
drop policy if exists "tg_dono_all" on public.telegram_links;
create policy "tg_dono_all" on public.telegram_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Permite origem 'telegram' nos lançamentos
alter table public.transacoes drop constraint if exists transacoes_origem_check;
alter table public.transacoes add constraint transacoes_origem_check
  check (origem in ('manual','audio','foto','whatsapp','telegram'));

-- 3) Permite origem 'telegram' nos comprovantes
alter table public.comprovantes drop constraint if exists comprovantes_origem_check;
alter table public.comprovantes add constraint comprovantes_origem_check
  check (origem in ('app','whatsapp','telegram'));
