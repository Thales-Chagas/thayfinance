// ============================================================
//  Thayfinance — Camada de dados na NUVEM (Supabase)
//  Lê/grava as tabelas e monta os dados no MESMO formato que a
//  interface já usa: { versao:2, pessoal:{...}, empresarial:{...} }.
//  Assim a tela quase não muda — só troca de onde vêm os dados.
//
//  Mapeamento: no app o "modo" (pessoal/empresarial) é o nível de cima;
//  no banco é uma COLUNA. E camelCase (categoriaId) vira snake (categoria_id).
//  RLS garante que cada pessoa só enxerga/escreve o próprio dado.
// ============================================================

import { supabase } from "./supabaseClient";

/* ---------- transações: app <-> linha do banco ---------- */
function txParaLinha(userId, modo, t) {
  return {
    id: t.id,
    user_id: userId,
    modo,
    tipo: t.tipo,
    status: t.status || "ok",
    data: t.data,
    valor: t.valor,
    descricao: t.descricao ?? null,
    categoria_id: t.categoriaId ?? null,
    cliente_id: t.clienteId ?? null,
    fornecedor_id: t.fornecedorId ?? null,
    centro_custo_id: t.centroCustoId ?? null,
    origem: t.origem || "manual",
  };
}
function txDeLinha(r) {
  return {
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
    origem: r.origem, // 'manual' | 'audio' | 'foto' | 'telegram' ...
  };
}

/* ---------- contatos (cliente/fornecedor): {id,nome,telefone,email,obs} ---------- */
function contatoParaLinha(userId, modo, c) {
  return {
    id: c.id,
    user_id: userId,
    modo,
    nome: c.nome,
    telefone: c.telefone ?? null,
    email: c.email ?? null,
    obs: c.obs ?? null,
  };
}
function contatoDeLinha(r) {
  return { id: r.id, nome: r.nome, telefone: r.telefone ?? "", email: r.email ?? "", obs: r.obs ?? "" };
}

const nomeParaLinha = (userId, modo, x) => ({ id: x.id, user_id: userId, modo, nome: x.nome });
const nomeDeLinha = (r) => ({ id: r.id, nome: r.nome });

function metaParaLinha(userId, modo, m) {
  return { id: m.id, user_id: userId, modo, nome: m.nome, alvo: m.alvo ?? 0, atual: m.atual ?? 0 };
}
const metaDeLinha = (r) => ({ id: r.id, nome: r.nome, alvo: Number(r.alvo), atual: Number(r.atual) });

/* ============================================================
   LEITURA — carrega tudo e monta o formato do app
   ============================================================ */
export async function carregarTudo() {
  const [tx, cat, met, cli, forn, cc] = await Promise.all([
    supabase.from("transacoes").select("*").order("data", { ascending: true }),
    supabase.from("categorias").select("*"),
    supabase.from("metas").select("*"),
    supabase.from("clientes").select("*"),
    supabase.from("fornecedores").select("*"),
    supabase.from("centros_custo").select("*"),
  ]);
  const erro = tx.error || cat.error || met.error || cli.error || forn.error || cc.error;
  if (erro) throw erro;

  const doModo = (modo) => ({
    transacoes: (tx.data || []).filter((r) => r.modo === modo).map(txDeLinha),
    categorias: (cat.data || []).filter((r) => r.modo === modo).map(nomeDeLinha),
    metas: (met.data || []).filter((r) => r.modo === modo).map(metaDeLinha),
    clientes: (cli.data || []).filter((r) => r.modo === modo).map(contatoDeLinha),
    fornecedores: (forn.data || []).filter((r) => r.modo === modo).map(contatoDeLinha),
    centrosCusto: (cc.data || []).filter((r) => r.modo === modo).map(nomeDeLinha),
  });

  return { versao: 2, pessoal: doModo("pessoal"), empresarial: doModo("empresarial") };
}

/* ============================================================
   ESCRITA — uma função por entidade (insere ou atualiza pelo id)
   Cada uma lança erro se falhar, pra a interface avisar.
   ============================================================ */
async function upsert(tabela, linha) {
  const { error } = await supabase.from(tabela).upsert(linha);
  if (error) throw error;
}
async function remover(tabela, id) {
  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error) throw error;
}

export const salvarTransacao = (userId, modo, t) => upsert("transacoes", txParaLinha(userId, modo, t));
export const excluirTransacao = (id) => remover("transacoes", id);

export const salvarCategoria = (userId, modo, c) => upsert("categorias", nomeParaLinha(userId, modo, c));
export const excluirCategoria = (id) => remover("categorias", id);

export const salvarMeta = (userId, modo, m) => upsert("metas", metaParaLinha(userId, modo, m));
export const excluirMeta = (id) => remover("metas", id);

export const salvarCliente = (userId, modo, c) => upsert("clientes", contatoParaLinha(userId, modo, c));
export const excluirCliente = (id) => remover("clientes", id);

export const salvarFornecedor = (userId, modo, f) => upsert("fornecedores", contatoParaLinha(userId, modo, f));
export const excluirFornecedor = (id) => remover("fornecedores", id);

export const salvarCentroCusto = (userId, modo, x) => upsert("centros_custo", nomeParaLinha(userId, modo, x));
export const excluirCentroCusto = (id) => remover("centros_custo", id);

/* ============================================================
   SINCRONIZAÇÃO — compara o estado ANTES e DEPOIS (na memória do app)
   e aplica só as diferenças na nuvem: novos/alterados = upsert, sumidos = delete.
   Assim as ações do app (que mexem no objeto inteiro) viram gravações certeiras,
   sem precisar reescrever cada botão. Pais (categorias/contatos/centros) antes
   das transações, por causa das chaves estrangeiras.
   ============================================================ */
export async function sincronizar(userId, antes, depois) {
  const pais = [];
  const trans = [];

  const diff = (balde, modo, chave, salvar, excluir) => {
    const a = (antes?.[modo]?.[chave]) || [];
    const d = (depois?.[modo]?.[chave]) || [];
    const mapaA = new Map(a.map((x) => [x.id, x]));
    const mapaD = new Map(d.map((x) => [x.id, x]));
    for (const item of d) {
      const anterior = mapaA.get(item.id);
      if (!anterior || JSON.stringify(anterior) !== JSON.stringify(item)) {
        balde.push(salvar(userId, modo, item));
      }
    }
    for (const item of a) {
      if (!mapaD.has(item.id)) balde.push(excluir(item.id));
    }
  };

  for (const modo of ["pessoal", "empresarial"]) {
    diff(pais, modo, "categorias", salvarCategoria, excluirCategoria);
    diff(pais, modo, "clientes", salvarCliente, excluirCliente);
    diff(pais, modo, "fornecedores", salvarFornecedor, excluirFornecedor);
    diff(pais, modo, "centrosCusto", salvarCentroCusto, excluirCentroCusto);
    diff(pais, modo, "metas", salvarMeta, excluirMeta);
    diff(trans, modo, "transacoes", salvarTransacao, excluirTransacao);
  }

  const r1 = await Promise.allSettled(pais);
  const r2 = await Promise.allSettled(trans);
  const falhou = [...r1, ...r2].find((r) => r.status === "rejected");
  if (falhou) throw falhou.reason;
}

/* ============================================================
   MIGRAÇÃO — sobe os dados locais (localStorage) para a nuvem no 1º login.
   Ordem respeita as chaves estrangeiras: categorias/contatos/centros
   ANTES das transações (que apontam pra eles). É idempotente (upsert por id).
   ============================================================ */
// Monta os lotes que serão enviados (função PURA, sem rede — por isso é
// testável). Casa categorias por nome com as que já estão na nuvem (não
// duplica), remapeia as transações e anula FKs órfãs. Devolve os arrays
// prontos + o mapa de remapeamento + contagem de reaproveitadas.
export function montarMigracao(userId, data, nuvem) {
  const modos = ["pessoal", "empresarial"];
  const categorias = [];
  const clientes = [];
  const fornecedores = [];
  const centros = [];
  const metas = [];
  const transacoes = [];

  // Categorias que JÁ existem na nuvem (ex.: criadas pelo bot do Telegram),
  // indexadas por "modo\nnome" — pra casar por nome e NÃO duplicar.
  // idsValidos = tudo que vai existir no banco após migrar (nuvem + o que sobe):
  // uma transação só pode apontar (FK) pra um desses, senão vira órfã.
  const catPorNome = new Map();
  const idsValidos = { categorias: new Set(), clientes: new Set(), fornecedores: new Set(), centros_custo: new Set() };
  const chaveCat = (modo, nome) => modo + "\n" + (nome || "").toLowerCase().trim();
  for (const modo of modos) {
    const n = nuvem?.[modo] || {};
    (n.categorias || []).forEach((c) => {
      catPorNome.set(chaveCat(modo, c.nome), c.id);
      idsValidos.categorias.add(c.id);
    });
    (n.clientes || []).forEach((c) => idsValidos.clientes.add(c.id));
    (n.fornecedores || []).forEach((c) => idsValidos.fornecedores.add(c.id));
    (n.centrosCusto || []).forEach((c) => idsValidos.centros_custo.add(c.id));
  }

  const remapCat = new Map(); // idLocal -> idNuvem (quando reaproveita uma já existente)
  let catReusadas = 0;

  for (const modo of modos) {
    const esp = data?.[modo];
    if (!esp) continue;

    (esp.categorias || []).forEach((c) => {
      const existente = catPorNome.get(chaveCat(modo, c.nome));
      if (existente && existente !== c.id) {
        remapCat.set(c.id, existente); // mesma categoria por nome → aponta pra da nuvem
        catReusadas++;
      } else {
        categorias.push(nomeParaLinha(userId, modo, c));
        catPorNome.set(chaveCat(modo, c.nome), c.id); // agora passa a existir (evita dup no lote)
        idsValidos.categorias.add(c.id);
      }
    });
    (esp.clientes || []).forEach((c) => {
      clientes.push(contatoParaLinha(userId, modo, c));
      idsValidos.clientes.add(c.id);
    });
    (esp.fornecedores || []).forEach((c) => {
      fornecedores.push(contatoParaLinha(userId, modo, c));
      idsValidos.fornecedores.add(c.id);
    });
    (esp.centrosCusto || []).forEach((c) => {
      centros.push(nomeParaLinha(userId, modo, c));
      idsValidos.centros_custo.add(c.id);
    });
    (esp.metas || []).forEach((m) => metas.push(metaParaLinha(userId, modo, m)));

    (esp.transacoes || []).forEach((t) => {
      const linha = txParaLinha(userId, modo, t);
      // 1) remapeia categoria deduplicada por nome
      if (linha.categoria_id && remapCat.has(linha.categoria_id))
        linha.categoria_id = remapCat.get(linha.categoria_id);
      // 2) anula qualquer FK que não vá existir no banco (órfã) — senão o lote inteiro falha
      if (linha.categoria_id && !idsValidos.categorias.has(linha.categoria_id)) linha.categoria_id = null;
      if (linha.cliente_id && !idsValidos.clientes.has(linha.cliente_id)) linha.cliente_id = null;
      if (linha.fornecedor_id && !idsValidos.fornecedores.has(linha.fornecedor_id)) linha.fornecedor_id = null;
      if (linha.centro_custo_id && !idsValidos.centros_custo.has(linha.centro_custo_id)) linha.centro_custo_id = null;
      transacoes.push(linha);
    });
  }

  return { categorias, clientes, fornecedores, centros, metas, transacoes, remapCat, catReusadas };
}

export async function migrarLocalParaNuvem(userId, data, nuvem) {
  const { categorias, clientes, fornecedores, centros, metas, transacoes, catReusadas } =
    montarMigracao(userId, data, nuvem);

  // 1) tabelas "pais" (podem entrar em paralelo)
  const passo1 = [
    categorias.length && supabase.from("categorias").upsert(categorias),
    clientes.length && supabase.from("clientes").upsert(clientes),
    fornecedores.length && supabase.from("fornecedores").upsert(fornecedores),
    centros.length && supabase.from("centros_custo").upsert(centros),
    metas.length && supabase.from("metas").upsert(metas),
  ].filter(Boolean);
  const r1 = await Promise.all(passo1);
  const e1 = r1.find((r) => r.error);
  if (e1) throw e1.error;

  // 2) transações (dependem das categorias/contatos/centros já existirem)
  if (transacoes.length) {
    const { error } = await supabase.from("transacoes").upsert(transacoes);
    if (error) throw error;
  }

  return {
    transacoes: transacoes.length,
    categorias: categorias.length,
    categoriasReusadas: catReusadas, // casadas por nome com as que já estavam na nuvem
    metas: metas.length,
    clientes: clientes.length,
    fornecedores: fornecedores.length,
    centrosCusto: centros.length,
  };
}
