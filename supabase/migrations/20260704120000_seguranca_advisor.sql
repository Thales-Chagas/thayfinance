-- ============================================================
--  Thayfinance — Ajustes de segurança apontados pelo Security Advisor
--  Cole este script inteiro no SQL Editor do Supabase e clique em RUN.
--  É IDEMPOTENTE (pode rodar quantas vezes quiser).
--  Resolve os avisos:
--   - "Function Search Path Mutable" (set_updated_at)
--   - "Public/Signed-In can execute SECURITY DEFINER function"
--     (handle_new_user, rls_auto_enable) — funções de GATILHO não precisam
--     de permissão de execução para o usuário final.
-- ============================================================

-- 1) Fixa o search_path da função de updated_at (evita "search_path mutável").
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) Reforça o search_path fixo na handle_new_user (mantém SECURITY DEFINER
--    porque ela insere em profiles no momento do cadastro).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));
  return new;
end;
$$;

-- 3) Remove o EXECUTE público das funções de GATILHO. Triggers rodam como dono
--    da tabela — o usuário final não precisa (nem deve) poder chamá-las direto.
--    Isso zera os avisos "callable by public / signed-in users".
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- rls_auto_enable() pode não existir em todos os ambientes — protege com um DO.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end$$;

-- ------------------------------------------------------------
-- Observação: o aviso "Extension in Public (pg_net)" NÃO é tratado aqui de
-- propósito — mover a extensão pg_net de schema pode quebrar integrações do
-- Supabase (pg_cron / webhooks). É seguro deixá-la como está.
-- ============================================================
