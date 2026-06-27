-- ============================================================
--  Thayfinance — Schema inicial (nuvem)
--  Espelha a estrutura do app (localStorage v2) + comprovantes (IA) + WhatsApp
--  TUDO com RLS: cada pessoa só enxerga os próprios dados.
--  É IDEMPOTENTE: pode rodar várias vezes sem dar erro.
--  Cole este script inteiro no SQL Editor do Supabase e clique em RUN.
-- ============================================================

-- ------------------------------------------------------------
-- Função utilitária: manter "updated_at" sempre atualizado
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1) PERFIS  (1 linha por usuário, criada automática no cadastro)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "perfil_proprio_select" on public.profiles;
create policy "perfil_proprio_select" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "perfil_proprio_update" on public.profiles;
create policy "perfil_proprio_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "perfil_proprio_insert" on public.profiles;
create policy "perfil_proprio_insert" on public.profiles
  for insert with check (auth.uid() = id);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- cria o perfil sozinho quando a pessoa se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Macro mental: quase toda tabela tem  user_id + modo (pessoal/empresarial)
-- ============================================================

-- ============================================================
-- 2) CATEGORIAS
-- ============================================================
create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  modo        text not null check (modo in ('pessoal','empresarial')),
  nome        text not null,
  created_at  timestamptz not null default now()
);
alter table public.categorias enable row level security;
drop policy if exists "cat_dono_all" on public.categorias;
create policy "cat_dono_all" on public.categorias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 3) CLIENTES e FORNECEDORES (contatos)
-- ============================================================
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  modo        text not null check (modo in ('pessoal','empresarial')),
  nome        text not null,
  telefone    text,
  email       text,
  obs         text,
  created_at  timestamptz not null default now()
);
alter table public.clientes enable row level security;
drop policy if exists "cli_dono_all" on public.clientes;
create policy "cli_dono_all" on public.clientes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.fornecedores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  modo        text not null check (modo in ('pessoal','empresarial')),
  nome        text not null,
  telefone    text,
  email       text,
  obs         text,
  created_at  timestamptz not null default now()
);
alter table public.fornecedores enable row level security;
drop policy if exists "forn_dono_all" on public.fornecedores;
create policy "forn_dono_all" on public.fornecedores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 4) CENTROS DE CUSTO
-- ============================================================
create table if not exists public.centros_custo (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  modo        text not null check (modo in ('pessoal','empresarial')),
  nome        text not null,
  created_at  timestamptz not null default now()
);
alter table public.centros_custo enable row level security;
drop policy if exists "cc_dono_all" on public.centros_custo;
create policy "cc_dono_all" on public.centros_custo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 5) METAS
-- ============================================================
create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  modo        text not null check (modo in ('pessoal','empresarial')),
  nome        text not null,
  alvo        numeric(14,2) not null default 0,
  atual       numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.metas enable row level security;
drop policy if exists "meta_dono_all" on public.metas;
create policy "meta_dono_all" on public.metas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 6) TRANSAÇÕES (lançamentos) — o coração do app
-- ============================================================
create table if not exists public.transacoes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  modo            text not null check (modo in ('pessoal','empresarial')),
  tipo            text not null check (tipo in ('receita','despesa')),
  status          text not null default 'ok' check (status in ('ok','pendente')),
  data            date not null,
  valor           numeric(14,2) not null,
  descricao       text,
  origem          text not null default 'manual'
                    check (origem in ('manual','audio','foto','whatsapp')),
  categoria_id    uuid references public.categorias(id) on delete set null,
  cliente_id      uuid references public.clientes(id) on delete set null,
  fornecedor_id   uuid references public.fornecedores(id) on delete set null,
  centro_custo_id uuid references public.centros_custo(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- caso a tabela já existisse de uma rodada anterior, garante a coluna origem
alter table public.transacoes
  add column if not exists origem text not null default 'manual';
alter table public.transacoes enable row level security;
drop policy if exists "tx_dono_all" on public.transacoes;
create policy "tx_dono_all" on public.transacoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_transacoes_user_modo_data
  on public.transacoes (user_id, modo, data);

drop trigger if exists trg_transacoes_updated on public.transacoes;
create trigger trg_transacoes_updated
  before update on public.transacoes
  for each row execute function public.set_updated_at();

-- ============================================================
-- 7) COMPROVANTES  (a função estrela: foto -> IA lê -> lança)
--    O arquivo em si fica no Storage privado; aqui guardamos o
--    caminho + o que a IA (Claude visão) extraiu.
-- ============================================================
create table if not exists public.comprovantes (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  transacao_id           uuid references public.transacoes(id) on delete set null,
  storage_path           text not null,              -- caminho no bucket privado
  nome_arquivo           text,
  mime_type              text,
  tamanho_bytes          bigint,
  origem                 text not null default 'app' check (origem in ('app','whatsapp')),
  -- resultado da leitura por IA
  ocr_status             text not null default 'pendente'
                           check (ocr_status in ('pendente','processando','concluido','erro')),
  ocr_bruto              jsonb,                       -- resposta crua do Claude (auditoria)
  extraido_valor         numeric(14,2),
  extraido_data          date,
  extraido_estabelecimento text,
  extraido_categoria     text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.comprovantes enable row level security;
drop policy if exists "comp_dono_all" on public.comprovantes;
create policy "comp_dono_all" on public.comprovantes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_comprovantes_user
  on public.comprovantes (user_id, created_at desc);

drop trigger if exists trg_comprovantes_updated on public.comprovantes;
create trigger trg_comprovantes_updated
  before update on public.comprovantes
  for each row execute function public.set_updated_at();

-- ============================================================
-- 8) VÍNCULO TELEFONE -> USUÁRIO  (pro robô do WhatsApp saber de quem é)
--    A Edge Function (webhook) consulta esta tabela pelo telefone.
-- ============================================================
create table if not exists public.phone_links (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  telefone            text not null unique,           -- formato E.164, ex: +5519999999999
  verificado_em       timestamptz,
  codigo_verificacao  text,                           -- código temporário p/ confirmar o número
  created_at          timestamptz not null default now()
);
alter table public.phone_links enable row level security;
drop policy if exists "tel_dono_all" on public.phone_links;
create policy "tel_dono_all" on public.phone_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 9) STORAGE — cofre privado dos comprovantes
--    Cada pessoa guarda dentro de uma pasta com o próprio id:
--    comprovantes/<user_id>/arquivo.jpg
-- ============================================================
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

drop policy if exists "comp_storage_select" on storage.objects;
create policy "comp_storage_select" on storage.objects
  for select using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "comp_storage_insert" on storage.objects;
create policy "comp_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "comp_storage_update" on storage.objects;
create policy "comp_storage_update" on storage.objects
  for update using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "comp_storage_delete" on storage.objects;
create policy "comp_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- FIM. Tabelas criadas, RLS ligado, Storage privado pronto.
-- ============================================================
