import { describe, it, expect } from "vitest";
import { categoriasPorUso, sugestoesDescricao, agruparPorDia, agruparPorCategoria, filtrarBusca, desfazerMudanca, normalizar } from "./transacoes";
import { soma, parseDinheiro } from "./formato";

const cats = [
  { id: "a", nome: "Alimentação" },
  { id: "t", nome: "Transporte" },
  { id: "m", nome: "Moradia" },
  { id: "s", nome: "Salário" },
];
const tx = [
  { id: "1", tipo: "despesa", data: "2026-09-20", categoriaId: "t", valor: 23.9, descricao: "Uber" },
  { id: "2", tipo: "despesa", data: "2026-09-21", categoriaId: "t", valor: 18.5, descricao: "uber" },
  { id: "3", tipo: "despesa", data: "2026-09-22", categoriaId: "a", valor: 86.4, descricao: "Mercado" },
  { id: "4", tipo: "despesa", data: "2026-09-10", categoriaId: "a", valor: 92.1, descricao: "Mercado" },
  { id: "5", tipo: "receita", data: "2026-09-05", categoriaId: "s", valor: 3000, descricao: "Salário" },
  { id: "6", tipo: "despesa", data: "2025-01-01", categoriaId: "m", valor: 10, descricao: "Antigo" },
];

describe("dinheiro", () => {
  it("soma em centavos não acumula erro", () => {
    expect(soma([{ valor: 0.1 }, { valor: 0.2 }])).toBe(0.3);
    expect(soma(Array.from({ length: 1000 }, () => ({ valor: 0.01 })))).toBe(10);
  });
  it("parseDinheiro entende milhar, vírgula e arredonda centavos", () => {
    expect(parseDinheiro("86,40")).toBe(86.4);
    expect(parseDinheiro("1.234,56")).toBe(1234.56);
    expect(parseDinheiro("1.234")).toBe(1234);
    expect(parseDinheiro("12.5")).toBe(12.5);
    expect(parseDinheiro("R$ 50")).toBe(50);
    expect(parseDinheiro("10,005")).toBe(10.01);
    expect(parseDinheiro("")).toBe(0);
    expect(parseDinheiro("abc")).toBeNull();
    expect(parseDinheiro("-5")).toBeNull();
  });
});

describe("categorias por uso", () => {
  it("mais usadas do tipo primeiro, depois as outras na ordem original", () => {
    const r = categoriasPorUso(tx, cats, "despesa", "2026-09-25").map((c) => c.id);
    expect(r).toEqual(["a", "t", "m", "s"]);
  });
  it("receitas olham só receitas", () => {
    expect(categoriasPorUso(tx, cats, "receita", "2026-09-25")[0].id).toBe("s");
  });
});

describe("sugestões pela descrição", () => {
  it("encontra ignorando acento e maiúscula e traz a categoria e o último valor", () => {
    const [s] = sugestoesDescricao(tx, "despesa", "merc");
    expect(s).toMatchObject({ descricao: "Mercado", categoriaId: "a", valor: 86.4, vezes: 2 });
  });
  it("sem texto mostra as repetidas mais frequentes", () => {
    const r = sugestoesDescricao(tx, "despesa", "");
    expect(r.map((x) => normalizar(x.descricao))).toEqual(["mercado", "uber"]);
  });
  it("não sugere o que já está digitado igual", () => {
    expect(sugestoesDescricao(tx, "despesa", "Mercado")).toEqual([]);
  });
});

describe("lista agrupada por dia", () => {
  it("dias do mais recente para o mais antigo, com saldo do dia", () => {
    const dias = agruparPorDia(tx.slice(0, 5));
    expect(dias[0]).toMatchObject({ data: "2026-09-22", total: -86.4 });
    expect(dias.at(-1)).toMatchObject({ data: "2026-09-05", total: 3000 });
  });
  it("busca por descrição, categoria ou valor", () => {
    const nome = (id) => cats.find((c) => c.id === id)?.nome;
    expect(filtrarBusca(tx, "alimenta", nome).map((t) => t.id)).toEqual(["3", "4"]);
    expect(filtrarBusca(tx, "86,4", nome).map((t) => t.id)).toEqual(["3"]);
    expect(filtrarBusca(tx, "", nome)).toBe(tx);
  });
});

describe("desfazer", () => {
  const base = [{ id: "x", status: "pendente" }, { id: "y", status: "ok" }];
  it("desfaz um lançamento novo", () => {
    const depois = [...base, { id: "novo" }];
    expect(desfazerMudanca(depois, base, depois)).toEqual(base);
  });
  it("desfaz uma exclusão", () => {
    const depois = [base[1]];
    expect(desfazerMudanca(depois, base, depois)).toEqual([base[1], base[0]]);
  });
  it("desfaz um 'Paguei'", () => {
    const depois = [{ ...base[0], status: "ok" }, base[1]];
    expect(desfazerMudanca(depois, base, depois)).toEqual(base);
  });
  it("não mexe no que mudou depois em outros lançamentos", () => {
    const depois = [...base, { id: "novo" }];
    const atual = [...depois, { id: "outro" }];
    expect(desfazerMudanca(atual, base, depois).map((t) => t.id)).toEqual(["x", "y", "outro"]);
  });
});

describe("lista agrupada por categoria", () => {
  it("categorias com mais dinheiro primeiro, itens do mais recente ao mais antigo", () => {
    const g = agruparPorCategoria(tx.slice(0, 5));
    expect(g.map((x) => x.categoriaId)).toEqual(["s", "a", "t"]);
    expect(g[1]).toMatchObject({ total: -178.5, volume: 178.5 });
    expect(g[1].itens.map((t) => t.id)).toEqual(["3", "4"]);
  });
});
