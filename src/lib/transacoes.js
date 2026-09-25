import { somaDias } from "./formato";

/* ============================================================
   LÓGICA DOS LANÇAMENTOS (pura, sem React — coberta por testes)
   ============================================================ */

// Texto sem acento e minúsculo, pra comparar "Açougue" com "acougue".
export const normalizar = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

// Categorias na ordem de uso para aquele tipo (receita/despesa) nos últimos
// 180 dias; as nunca usadas vêm depois, na ordem em que foram criadas.
export function categoriasPorUso(transacoes, categorias, tipo, hoje) {
  const desde = somaDias(hoje, -180);
  const uso = new Map();
  for (const t of transacoes) {
    if (t.tipo !== tipo || !t.categoriaId || t.data < desde) continue;
    uso.set(t.categoriaId, (uso.get(t.categoriaId) || 0) + 1);
  }
  return categorias
    .map((c, i) => ({ c, i, n: uso.get(c.id) || 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.c);
}

// Sugestões pela descrição: lançamentos anteriores do mesmo tipo cuja descrição
// começa (ou contém) o que foi digitado. Sem texto → as mais frequentes.
// Cada sugestão traz a categoria e o valor do lançamento mais recente.
export function sugestoesDescricao(transacoes, tipo, texto, limite = 3) {
  const alvo = normalizar(texto);
  const grupos = new Map();
  for (const t of transacoes) {
    if (t.tipo !== tipo || !t.descricao) continue;
    const chave = normalizar(t.descricao);
    if (!chave) continue;
    const g = grupos.get(chave);
    if (!g) grupos.set(chave, { descricao: t.descricao.trim(), categoriaId: t.categoriaId, valor: t.valor, data: t.data, vezes: 1 });
    else {
      g.vezes++;
      if (t.data > g.data) Object.assign(g, { descricao: t.descricao.trim(), categoriaId: t.categoriaId, valor: t.valor, data: t.data });
    }
  }
  let lista = [...grupos.entries()];
  if (alvo) {
    lista = lista
      .filter(([chave]) => chave !== alvo && chave.includes(alvo))
      .sort(([a, ga], [b, gb]) => (b.startsWith(alvo) - a.startsWith(alvo)) || gb.vezes - ga.vezes || gb.data.localeCompare(ga.data));
  } else {
    lista = lista.filter(([, g]) => g.vezes > 1).sort(([, ga], [, gb]) => gb.vezes - ga.vezes || gb.data.localeCompare(ga.data));
  }
  return lista.slice(0, limite).map(([, g]) => g);
}

// Agrupa por dia (mais recente primeiro). `total` = entradas − saídas do dia.
export function agruparPorDia(lista) {
  const dias = new Map();
  for (const t of lista) {
    if (!dias.has(t.data)) dias.set(t.data, []);
    dias.get(t.data).push(t);
  }
  return [...dias.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([data, itens]) => ({
      data,
      itens,
      total: centavos(itens.reduce((s, t) => s + (t.tipo === "receita" ? 1 : -1) * Math.round((Number(t.valor) || 0) * 100), 0)),
    }));
}
const centavos = (n) => n / 100;

// Busca por descrição, nome da categoria ou valor ("86,4" acha R$ 86,40).
export function filtrarBusca(lista, texto, nomeCategoria) {
  const alvo = normalizar(texto);
  if (!alvo) return lista;
  const alvoNum = alvo.replace(/\./g, "").replace(",", ".");
  return lista.filter((t) => {
    if (normalizar(t.descricao).includes(alvo)) return true;
    if (normalizar(nomeCategoria(t.categoriaId)).includes(alvo)) return true;
    return /^\d/.test(alvoNum) && Number(t.valor).toFixed(2).includes(alvoNum);
  });
}

// DESFAZER: dado o estado ANTES e DEPOIS de uma ação, devolve o `atual` com a
// ação revertida — tira o que foi criado, devolve o que foi apagado e restaura
// o que foi alterado. Trabalha por id, então não atrapalha o que mudou em
// outros lançamentos nesse meio-tempo.
export function desfazerMudanca(atual, antes, depois) {
  const mapaA = new Map(antes.map((t) => [t.id, t]));
  const mapaD = new Map(depois.map((t) => [t.id, t]));
  const criados = new Set([...mapaD.keys()].filter((id) => !mapaA.has(id)));
  const resultado = atual
    .filter((t) => !criados.has(t.id))
    .map((t) => (mapaA.has(t.id) && mapaD.has(t.id) && mapaD.get(t.id) !== mapaA.get(t.id) ? mapaA.get(t.id) : t));
  const presentes = new Set(resultado.map((t) => t.id));
  for (const t of antes) if (!mapaD.has(t.id) && !presentes.has(t.id)) resultado.push(t);
  return resultado;
}
