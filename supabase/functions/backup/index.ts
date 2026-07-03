// ============================================================
//  Thayfinance — Backup automático (roda por agendamento a cada 3 dias)
//  Lê TODOS os dados de TODOS os usuários (service_role, passa por cima da
//  RLS), monta um JSON por usuário no MESMO formato do "Exportar dados" do
//  app e guarda no bucket privado 'backups' (backups/{user_id}/{data}.json).
//  Mantém os mais recentes e apaga os antigos.
//
//  Segurança: só roda com o header X-Backup-Secret correto (BACKUP_SECRET).
//             O agendador (pg_cron) envia esse header. Sem ele = 401.
//  Segredos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BACKUP_SECRET
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BACKUP_SECRET = Deno.env.get("BACKUP_SECRET")!;

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

const BUCKET = "backups";
const MANTER = 12; // quantos backups guardar por usuário (apaga os mais antigos)

// ---- mapeadores linha do banco -> formato do app (igual ao cloudData.js) ----
const txDeLinha = (r: any) => ({
  id: r.id,
  tipo: r.tipo,
  status: r.status,
  data: r.data,
  valor: Number(r.valor),
  descricao: r.descricao ?? "",
  categoriaId: r.categoria_id ?? null,
  clienteId: r.cliente_id ?? null,
  fornecedorId: r.fornecedor_id ?? null,
  centroCustoId: r.centro_custo_id ?? null,
  origem: r.origem,
});
const nomeDeLinha = (r: any) => ({ id: r.id, nome: r.nome });
const contatoDeLinha = (r: any) => ({
  id: r.id, nome: r.nome, telefone: r.telefone ?? "", email: r.email ?? "", obs: r.obs ?? "",
});
const metaDeLinha = (r: any) => ({ id: r.id, nome: r.nome, alvo: Number(r.alvo), atual: Number(r.atual) });

// separa as linhas de um usuário por modo e monta {transacoes, categorias, ...}
function montarModo(modo: string, dados: any) {
  const f = (arr: any[], map: (r: any) => any) => arr.filter((r) => r.modo === modo).map(map);
  return {
    transacoes: f(dados.tx, txDeLinha),
    categorias: f(dados.cat, nomeDeLinha),
    metas: f(dados.met, metaDeLinha),
    clientes: f(dados.cli, contatoDeLinha),
    fornecedores: f(dados.forn, contatoDeLinha),
    centrosCusto: f(dados.cc, nomeDeLinha),
  };
}

async function rodarBackup() {
  // 1) puxa tudo de uma vez (uma consulta por tabela; service_role vê todos)
  const [tx, cat, met, cli, forn, cc] = await Promise.all([
    db.from("transacoes").select("*").order("data", { ascending: true }),
    db.from("categorias").select("*"),
    db.from("metas").select("*"),
    db.from("clientes").select("*"),
    db.from("fornecedores").select("*"),
    db.from("centros_custo").select("*"),
  ]);
  const erro = tx.error || cat.error || met.error || cli.error || forn.error || cc.error;
  if (erro) throw erro;

  // 2) descobre todos os user_ids que têm QUALQUER dado
  const todos = [
    ...(tx.data || []), ...(cat.data || []), ...(met.data || []),
    ...(cli.data || []), ...(forn.data || []), ...(cc.data || []),
  ];
  const usuarios = [...new Set(todos.map((r: any) => r.user_id).filter(Boolean))];

  const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19); // 2026-07-03T22-40-00
  let arquivos = 0;

  // 3) um JSON por usuário, no formato do "Exportar dados"
  for (const uid of usuarios) {
    const meu = (arr: any[]) => arr.filter((r) => r.user_id === uid);
    const dados = {
      tx: meu(tx.data || []), cat: meu(cat.data || []), met: meu(met.data || []),
      cli: meu(cli.data || []), forn: meu(forn.data || []), cc: meu(cc.data || []),
    };
    const backup = {
      versao: 2,
      geradoEm: new Date().toISOString(),
      origem: "backup-automatico",
      userId: uid,
      pessoal: montarModo("pessoal", dados),
      empresarial: montarModo("empresarial", dados),
    };
    const caminho = `${uid}/${carimbo}.json`;
    const { error: eUp } = await db.storage.from(BUCKET).upload(
      caminho,
      new Blob([JSON.stringify(backup)], { type: "application/json" }),
      { contentType: "application/json", upsert: true },
    );
    if (eUp) { console.error(`falha ao subir backup de ${uid}:`, eUp); continue; }
    arquivos++;

    // 4) higiene: mantém os MANTER mais recentes, apaga o resto
    const { data: lista } = await db.storage.from(BUCKET).list(uid, {
      limit: 1000, sortBy: { column: "name", order: "desc" },
    });
    if (lista && lista.length > MANTER) {
      const apagar = lista.slice(MANTER).map((f) => `${uid}/${f.name}`);
      if (apagar.length) await db.storage.from(BUCKET).remove(apagar);
    }
  }

  return { usuarios: usuarios.length, arquivos, carimbo };
}

// ============================================================
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  if (req.headers.get("X-Backup-Secret") !== BACKUP_SECRET) {
    return new Response("forbidden", { status: 401 });
  }
  try {
    const resultado = await rodarBackup();
    console.log("backup ok:", JSON.stringify(resultado));
    return new Response(JSON.stringify({ ok: true, ...resultado }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("erro no backup:", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
