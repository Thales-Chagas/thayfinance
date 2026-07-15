-- ============================================================
--  Thayfinance — Notificações push (Web Push)
--  Guarda a "assinatura" de push de cada aparelho do usuário.
--  A Edge Function `notificar` (service_role) lê esta tabela para
--  enviar as notificações; o app grava/apaga a própria assinatura.
--  IDEMPOTENTE: pode rodar várias vezes sem dar erro.
-- ============================================================

create table if not exists public.push_subscriptions (
  -- o endpoint é único por aparelho/navegador — serve de chave
  endpoint    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- chaves públicas da assinatura (vêm do navegador; não são segredos)
  p256dh      text not null,
  auth        text not null,
  -- ajuda a identificar o aparelho na hora de depurar
  aparelho    text,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_dono_all" on public.push_subscriptions;
create policy "push_dono_all" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_push_user
  on public.push_subscriptions (user_id);
