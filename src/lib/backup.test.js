import { describe, it, expect } from "vitest";
import { serializarBackup, lerBackup, nomeArquivoBackup } from "./backup";
import { normalizarDados, dadosVazios } from "./dados";

// Backup "de verdade" no formato que o app exporta hoje (v2), com todos os
// campos opcionais que já existem em produção: recorrência, comprovante, cor
// de categoria, origem, cliente/fornecedor/centro de custo.
const exportado = {
  versao: 2,
  pessoal: {
    transacoes: [
      { id: "11111111-1111-4111-8111-111111111111", tipo: "despesa", data: "2026-06-15", categoriaId: "c1", valor: 86.4, descricao: "Mercado", status: "ok", origem: "manual" },
      { id: "22222222-2222-4222-8222-222222222222", tipo: "despesa", data: "2026-07-05", categoriaId: "c2", valor: 350, descricao: "Aluguel", status: "pendente",
        recorrencia: { grupo: "g1", tipo: "mensal", cada: null, inicio: "2026-07-05", fim: null, n: 0 } },
      { id: "33333333-3333-4333-8333-333333333333", tipo: "receita", data: "2026-06-10", categoriaId: "c3", valor: 1234.56, descricao: "Salário", status: "ok", comprovante: "data:image/jpeg;base64,AAAA", origem: "foto" },
    ],
    categorias: [
      { id: "c1", nome: "Alimentação", cor: "tangerina" },
      { id: "c2", nome: "Moradia" },
      { id: "c3", nome: "Salário" },
    ],
    metas: [{ id: "m1", nome: "Reserva", alvo: 10000, atual: 2500.5 }],
    clientes: [],
    fornecedores: [],
    centrosCusto: [],
  },
  empresarial: {
    transacoes: [
      { id: "44444444-4444-4444-8444-444444444444", tipo: "receita", data: "2026-06-20", categoriaId: "e1", valor: 120, descricao: "Sessão", status: "ok", clienteId: "cl1", fornecedorId: "", centroCustoId: "" },
      { id: "55555555-5555-4555-8555-555555555555", tipo: "despesa", data: "2026-06-21", categoriaId: "e2", valor: 45.9, descricao: "Material", status: "ok", clienteId: "", fornecedorId: "f1", centroCustoId: "cc1" },
    ],
    categorias: [{ id: "e1", nome: "Faturamento" }, { id: "e2", nome: "Fornecedores", cor: "roxo" }],
    metas: [],
    clientes: [{ id: "cl1", nome: "Ana", telefone: "11 99999-0000", email: "ana@exemplo.com", obs: "" }],
    fornecedores: [{ id: "f1", nome: "Loja X", telefone: "", email: "", obs: "" }],
    centrosCusto: [{ id: "cc1", nome: "Clínica" }],
  },
};

describe("backup — formato travado", () => {
  it("exportar e importar devolve exatamente os mesmos dados", () => {
    const texto = serializarBackup(exportado);
    expect(lerBackup(texto)).toEqual(exportado);
  });

  it("o arquivo exportado é o JSON do estado, indentado com 2 espaços", () => {
    expect(serializarBackup(exportado)).toBe(JSON.stringify(exportado, null, 2));
  });

  it("mantém as chaves de topo e de cada espaço", () => {
    const lido = lerBackup(serializarBackup(exportado));
    expect(Object.keys(lido)).toEqual(["versao", "pessoal", "empresarial"]);
    const chaves = ["transacoes", "categorias", "metas", "clientes", "fornecedores", "centrosCusto"];
    expect(Object.keys(lido.pessoal).sort()).toEqual([...chaves].sort());
    expect(Object.keys(lido.empresarial).sort()).toEqual([...chaves].sort());
  });

  it("valores em centavos não perdem precisão na volta", () => {
    const lido = lerBackup(serializarBackup(exportado));
    expect(lido.pessoal.transacoes[2].valor).toBe(1234.56);
    expect(lido.pessoal.metas[0].atual).toBe(2500.5);
  });

  it("importa o backup automático da nuvem (campos extras e categorias sem cor)", () => {
    const daNuvem = {
      versao: 2,
      geradoEm: "2026-07-03T22:40:00.000Z",
      origem: "backup-automatico",
      userId: "uuid-do-usuario",
      pessoal: {
        transacoes: [{ id: "a", tipo: "despesa", status: "ok", data: "2026-07-01", valor: 10, descricao: "", categoriaId: null, clienteId: null, fornecedorId: null, centroCustoId: null, origem: "manual" }],
        categorias: [{ id: "c", nome: "Outros" }],
        metas: [], clientes: [], fornecedores: [], centrosCusto: [],
      },
      empresarial: { transacoes: [], categorias: [], metas: [], clientes: [], fornecedores: [], centrosCusto: [] },
    };
    const lido = lerBackup(JSON.stringify(daNuvem));
    expect(lido.versao).toBe(2);
    expect(lido.pessoal.transacoes).toEqual(daNuvem.pessoal.transacoes);
    expect(lido.pessoal.categorias).toEqual(daNuvem.pessoal.categorias);
  });

  it("backup antigo sem alguma lista ganha a lista padrão, sem perder o resto", () => {
    const antigo = { versao: 2, pessoal: { transacoes: exportado.pessoal.transacoes }, empresarial: { transacoes: [] } };
    const lido = lerBackup(JSON.stringify(antigo));
    expect(lido.pessoal.transacoes).toEqual(exportado.pessoal.transacoes);
    expect(lido.pessoal.categorias.length).toBeGreaterThan(0);
    expect(lido.empresarial.clientes).toEqual([]);
  });

  it("continua aceitando as planilhas antigas (v1) e convertendo para lançamentos", () => {
    const v1 = { months: { "2026-02": { pessoais: { p18: 943.83 }, dre: { faturamento: 5000 } } } };
    const lido = lerBackup(JSON.stringify(v1));
    expect(lido.versao).toBe(2);
    const mercado = lido.pessoal.transacoes.find((t) => t.descricao === "Mercado");
    expect(mercado).toMatchObject({ tipo: "despesa", data: "2026-02-15", valor: 943.83, status: "ok" });
    expect(lido.empresarial.transacoes.find((t) => t.tipo === "receita").valor).toBe(5000);
  });

  it("recusa arquivo que não é backup", () => {
    expect(lerBackup(JSON.stringify({ qualquer: 1 }))).toBeNull();
    expect(() => lerBackup("não é json")).toThrow();
  });

  it("nome do arquivo segue o padrão thayfinance-AAAA-MM-DD.json", () => {
    expect(nomeArquivoBackup(new Date("2026-09-25T12:00:00Z"))).toBe("thayfinance-2026-09-25.json");
  });

  it("dados vazios têm o mesmo formato de um backup", () => {
    const v = dadosVazios();
    expect(normalizarDados(JSON.parse(serializarBackup(v)))).toEqual(v);
  });
});
