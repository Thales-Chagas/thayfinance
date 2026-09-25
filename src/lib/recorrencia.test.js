import { describe, it, expect } from "vitest";
import { dataRecorrencia, totalParcelas, gerarProximasOcorrencias, estenderRecorrencias } from "./recorrencia";
import { parseBR, somaMeses, somaDias, soma, fmtData } from "./formato";

describe("formato", () => {
  it("parseBR entende os jeitos comuns de digitar dinheiro", () => {
    expect(parseBR("86,40")).toBe(86.4);
    expect(parseBR("1.234,56")).toBe(1234.56);
    expect(parseBR("R$ 50")).toBe(50);
    expect(parseBR("12.5")).toBe(12.5);
    expect(parseBR("")).toBe(0);
    expect(parseBR("abc")).toBeNull();
  });

  it("somaMeses ancora no dia original e encosta no fim do mês curto", () => {
    expect(somaMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somaMeses("2026-01-31", 2)).toBe("2026-03-31");
    expect(somaMeses("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("somaDias atravessa meses e anos", () => {
    expect(somaDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(somaDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("soma e fmtData", () => {
    expect(soma([{ valor: 10 }, { valor: "5.5" }, { valor: null }])).toBe(15.5);
    expect(fmtData("2026-09-25")).toBe("25/09/2026");
  });
});

describe("recorrência", () => {
  const regra = { grupo: "g", tipo: "mensal", cada: null, inicio: "2026-01-31", fim: "2026-06-30", n: 0 };

  it("calcula as datas da série", () => {
    expect(dataRecorrencia(regra, 0)).toBe("2026-01-31");
    expect(dataRecorrencia(regra, 1)).toBe("2026-02-28");
    expect(dataRecorrencia({ ...regra, tipo: "dias", cada: 10 }, 2)).toBe("2026-02-20");
  });

  it("conta as parcelas de uma série com fim", () => {
    expect(totalParcelas(regra)).toBe(6);
    expect(totalParcelas({ ...regra, fim: null })).toBeNull();
  });

  it("ids das parcelas são determinísticos (dois aparelhos não duplicam)", () => {
    const modelo = { tipo: "despesa", valor: 350, descricao: "Aluguel", categoriaId: "c" };
    const a = gerarProximasOcorrencias(modelo, regra, 1, new Set());
    const b = gerarProximasOcorrencias(modelo, regra, 1, new Set());
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(a.every((x) => x.status === "pendente" && x.valor === 350)).toBe(true);
  });

  it("estender não recria parcelas que já existem", () => {
    const modelo = { id: "base", tipo: "despesa", valor: 10, data: regra.inicio, status: "ok", recorrencia: regra };
    const extras = estenderRecorrencias([modelo]);
    expect(estenderRecorrencias([modelo, ...extras])).toEqual([]);
  });
});
