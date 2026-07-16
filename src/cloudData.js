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

/* ---------- normalização de ids (colunas do banco são uuid) ----------
   Dados antigos podem ter id NÃO-uuid (o uid() do app cai num fallback
   Date.now()+random quando o navegador não tem crypto.randomUUID — comum em
   celular). O Postgres recusa esses ids na coluna uuid. Então convertemos
   ids não-uuid para um uuid DETERMINÍSTICO (mesma entrada → mesmo uuid), pra
   reimportar o mesmo backup não duplicar. ----------------------------- */
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (s) => typeof s === "string" && RE_UUID.test(s);

// uuid estável a partir de uma string (4 blocos FNV-1a com sementes distintas).
// Não é criptográfico — só precisa ser determinístico e bem distribuído.
// Exportado: o app usa pra dar id PREVISÍVEL às ocorrências de recorrência
// (mesma série + mesma parcela = mesmo id ⇒ dois aparelhos não duplicam).
export function uuidDeString(str) {
  const s = String(str);
  const bloco = (seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  };
  const hex = bloco(2166136261) + bloco(2246822519) + bloco(3266489917) + bloco(668265263);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// id final para uma linha que vai subir: mantém se já é uuid, senão normaliza.
const idFinal = (oldId) => (ehUuid(oldId) ? oldId : uuidDeString(oldId));

/* ---------- transações: app <-> linha do banco ---------- */
// FK opcional: o formulário usa "" quando não escolhe cliente/fornecedor/centro,
// mas a coluna é uuid — string vazia dá erro 22P02 no Postgres. "" → null.
const fkOuNull = (v) => (v ? v : null);
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
    categoria_id: fkOuNull(t.categoriaId),
    cliente_id: fkOuNull(t.clienteId),
    fornecedor_id: fkOuNull(t.fornecedorId),
    centro_custo_id: fkOuNull(t.centroCustoId),
    origem: t.origem || "manual",
    recorrencia: t.recorrencia ?? null, // regra da série (jsonb) — null = avulso
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
    ...(r.recorrencia ? { recorrencia: r.recorrencia } : {}),
  };
}

// Upsert de transações TOLERANTE: se a coluna `recorrencia` ainda não existir
// no banco (migration recorrencia não rodada), tenta de novo sem ela — o app
// segue funcionando e a regra passa a persistir quando a migration rodar.
async function upsertTransacoes(linhas) {
  let { error } = await supabase.from("transacoes").upsert(linhas);
  if (error && error.code === "PGRST204" && /recorrencia/i.test(error.message || "")) {
    ({ error } = await supabase.from("transacoes").upsert(linhas.map(({ recorrencia: _r, ...t }) => t)));
  }
  return { error };
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

/* ---------- categorias: além do nome, têm a COR (gradiente escolhido) ---------- */
const catParaLinha = (userId, modo, c) => ({
  id: c.id,
  user_id: userId,
  modo,
  nome: c.nome,
  cor: c.cor ?? null,
});
const catDeLinha = (r) => ({ id: r.id, nome: r.nome, ...(r.cor ? { cor: r.cor } : {}) });

// Upsert de categorias TOLERANTE: se a coluna `cor` ainda não existir no banco
// (migration categoria_cor não rodada), tenta de novo sem a cor — o app segue
// funcionando e a cor passa a persistir quando a migration rodar.
async function upsertCategorias(linhas) {
  let { error } = await supabase.from("categorias").upsert(linhas);
  if (error && error.code === "PGRST204" && /cor/i.test(error.message || "")) {
    ({ error } = await supabase.from("categorias").upsert(linhas.map(({ cor: _cor, ...r }) => r)));
  }
  return { error };
}

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
    categorias: (cat.data || []).filter((r) => r.modo === modo).map(catDeLinha),
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

export const salvarTransacao = async (userId, modo, t) => {
  const { error } = await upsertTransacoes([txParaLinha(userId, modo, t)]);
  if (error) throw error;
};
export const excluirTransacao = (id) => remover("transacoes", id);

export const salvarCategoria = async (userId, modo, c) => {
  const { error } = await upsertCategorias([catParaLinha(userId, modo, c)]);
  if (error) throw error;
};
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
  const catPorNome = new Map();
  const chaveCat = (modo, nome) => modo + "\n" + (nome || "").toLowerCase().trim();
  for (const modo of modos) {
    (nuvem?.[modo]?.categorias || []).forEach((c) => catPorNome.set(chaveCat(modo, c.nome), c.id));
  }

  // Mapas idLocal -> idFinal (uuid que REALMENTE vai pro banco) por entidade.
  // Cobrem os dois casos: (a) categoria casada por nome com a da nuvem, e
  // (b) id não-uuid normalizado. As transações resolvem suas FKs por aqui —
  // se o id não estiver no mapa, é órfão → null (senão o lote falha).
  const fCat = new Map(), fCli = new Map(), fForn = new Map(), fCc = new Map();
  let catReusadas = 0;

  for (const modo of modos) {
    const esp = data?.[modo];
    if (!esp) continue;

    (esp.categorias || []).forEach((c) => {
      const existente = catPorNome.get(chaveCat(modo, c.nome));
      if (existente) {
        fCat.set(c.id, existente); // reusa a da nuvem (mesmo nome)
        if (existente !== c.id) catReusadas++;
      } else {
        const nid = idFinal(c.id);
        categorias.push(catParaLinha(userId, modo, { ...c, id: nid }));
        catPorNome.set(chaveCat(modo, c.nome), nid); // evita dup no mesmo lote
        fCat.set(c.id, nid);
      }
    });
    (esp.clientes || []).forEach((c) => {
      const nid = idFinal(c.id);
      clientes.push(contatoParaLinha(userId, modo, { ...c, id: nid }));
      fCli.set(c.id, nid);
    });
    (esp.fornecedores || []).forEach((c) => {
      const nid = idFinal(c.id);
      fornecedores.push(contatoParaLinha(userId, modo, { ...c, id: nid }));
      fForn.set(c.id, nid);
    });
    (esp.centrosCusto || []).forEach((c) => {
      const nid = idFinal(c.id);
      centros.push(nomeParaLinha(userId, modo, { ...c, id: nid }));
      fCc.set(c.id, nid);
    });
    (esp.metas || []).forEach((m) => metas.push(metaParaLinha(userId, modo, { ...m, id: idFinal(m.id) })));

    (esp.transacoes || []).forEach((t) => {
      const linha = txParaLinha(userId, modo, { ...t, id: idFinal(t.id) });
      // resolve cada FK pelo mapa (id local -> id final); ausente = órfã → null
      linha.categoria_id = t.categoriaId != null && fCat.has(t.categoriaId) ? fCat.get(t.categoriaId) : null;
      linha.cliente_id = t.clienteId != null && fCli.has(t.clienteId) ? fCli.get(t.clienteId) : null;
      linha.fornecedor_id = t.fornecedorId != null && fForn.has(t.fornecedorId) ? fForn.get(t.fornecedorId) : null;
      linha.centro_custo_id = t.centroCustoId != null && fCc.has(t.centroCustoId) ? fCc.get(t.centroCustoId) : null;
      transacoes.push(linha);
    });
  }

  return { categorias, clientes, fornecedores, centros, metas, transacoes, catReusadas };
}

export async function migrarLocalParaNuvem(userId, data, nuvem) {
  const { categorias, clientes, fornecedores, centros, metas, transacoes, catReusadas } =
    montarMigracao(userId, data, nuvem);

  // 1) tabelas "pais" (podem entrar em paralelo)
  const passo1 = [
    categorias.length && upsertCategorias(categorias),
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
    const { error } = await upsertTransacoes(transacoes);
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
