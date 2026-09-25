import { CATS_PESSOAL, CATS_EMPRESA } from "./constantes";
import { uid } from "./formato";

// Dados reais importados das planilhas — o arquivo fica só neste computador,
// fora do repositório público. Na versão publicada ele não existe e o app
// abre vazio (os dados entram pelo botão "Importar dados").
export const seedFiles = import.meta.glob("../dadosPlanilha.json", { eager: true });
export const SEED = seedFiles["../dadosPlanilha.json"]?.default ?? { months: {} };


/* ============================================================
   ESTRUTURA DOS DADOS (v2 — lançamentos)
   ============================================================ */

export function espacoVazio(modo) {
  const nomes = modo === "empresarial" ? CATS_EMPRESA : CATS_PESSOAL;
  return {
    transacoes: [], // {id, tipo, data, categoriaId, valor, descricao, status, clienteId?, fornecedorId?, centroCustoId?}
    categorias: nomes.map((nome) => ({ id: uid(), nome })),
    metas: [], // {id, nome, alvo, atual}
    clientes: [],
    fornecedores: [],
    centrosCusto: [],
  };
}

export const dadosVazios = () => ({
  versao: 2,
  pessoal: espacoVazio("pessoal"),
  empresarial: espacoVazio("empresarial"),
});

/* ============================================================
   MIGRAÇÃO v1 → v2 (planilhas / app antigo → lançamentos)
   ============================================================ */

export const V1_PESSOAIS = [
  "CPFL", "Naturgy", "Netflix", "Disney", "Internet", "Faxina", "Tim",
  "Combustível", "Cartão MEI", "Cartão Mãe", "Cartão Xuxu", "Cartão Havan",
  "Outros cartões", "Restaurantes", "Roupas Thaysa", "Ana Boucles", "Viagem",
  "Chácara Natal", "Mercado", "Pós-graduação", "Custos variáveis",
  "Noite das meninas", "Anderson-edi", "Thais ateliê", "Roupas Thales",
  "Manicure", "Farmácia", "Psicóloga mãe", "Uber", "Cílios/Sobrancelha",
  "Transferências marido", "Massagem/Lipo", "Dentista",
  "Idas para São Paulo", "Outros",
];
export const V1_PESSOAIS_CAT = {
  0: "Moradia", 1: "Moradia", 2: "Lazer", 3: "Lazer", 4: "Moradia",
  5: "Moradia", 6: "Moradia", 7: "Transporte", 13: "Alimentação",
  16: "Lazer", 17: "Lazer", 18: "Alimentação", 21: "Lazer", 25: "Lazer",
  26: "Saúde", 27: "Saúde", 28: "Transporte", 29: "Lazer", 31: "Saúde",
  32: "Saúde", 33: "Transporte",
};
export const V1_FIXOS = {
  aluguel: ["Aluguel", "Infraestrutura"], iptu: ["IPTU", "Impostos"],
  marketing: ["Marketing", "Marketing"], internet: ["Internet", "Infraestrutura"],
  materialAuriculo: ["Material auriculoterapia", "Fornecedores"],
  materialMassagem: ["Material massagem", "Fornecedores"],
  sistema: ["Sistema/Aplicativo", "Infraestrutura"], crefito: ["CREFITO", "Impostos"],
  energia: ["Energia elétrica", "Infraestrutura"], agua: ["Água", "Infraestrutura"],
  datasMkt: ["Datas comemorativas MKT", "Marketing"],
  estacionamento: ["Estacionamento", "Infraestrutura"],
  contador: ["Contador", "Funcionários"], inss: ["INSS", "Impostos"],
  prolabore: ["Pró-labore", "Funcionários"], faxineira: ["Faxineira", "Funcionários"],
  ferias13: ["Férias e 13º", "Funcionários"],
  investimentos: ["Investimentos", "Investimentos"],
  reserva: ["Reserva de emergência", "Investimentos"],
  refeicao: ["Refeição funcionários", "Funcionários"],
  mercado: ["Despesas de mercado", "Fornecedores"],
};
export const V1_VARIAVEIS = {
  impostoVenda: ["Imposto sobre venda", "Impostos"],
  taxaCartao: ["Taxa de cartão", "Outros"],
  cafeBiscoitos: ["Café/biscoitos", "Fornecedores"],
  lembrancinhas: ["Lembrancinhas", "Fornecedores"],
  materialLimpeza: ["Material de limpeza", "Fornecedores"],
  outrosVariaveis: ["Outros variáveis", "Outros"],
};
export const V1_ANUAIS = {
  contadora13: ["13º Contadora", "Funcionários"],
  faxineira13: ["13º Faxineira", "Funcionários"],
  certificadoDigital: ["Certificado digital", "Outros"],
};

export function migrarV1(antigo) {
  const novo = dadosVazios();
  const catId = (esp, nome) => {
    let c = esp.categorias.find((x) => x.nome === nome);
    if (!c) {
      c = { id: uid(), nome };
      esp.categorias.push(c);
    }
    return c.id;
  };
  const meses = (antigo && antigo.months) || {};
  Object.keys(meses)
    .sort()
    .forEach((chave) => {
      const m = meses[chave] || {};
      const dia15 = `${chave}-15`;
      const addDespesa = (esp, valor, descricao, catNome) => {
        if (!valor || valor <= 0) return;
        esp.transacoes.push({
          id: uid(), tipo: "despesa", data: dia15,
          categoriaId: catId(esp, catNome),
          valor: Math.round(valor * 100) / 100,
          descricao, status: "ok",
        });
      };
      // Gastos pessoais
      Object.entries(m.pessoais || {}).forEach(([k, v]) => {
        const i = parseInt(k.slice(1), 10);
        addDespesa(novo.pessoal, Number(v), V1_PESSOAIS[i] || "Outros",
          V1_PESSOAIS_CAT[i] || "Outros");
      });
      // Custos do negócio
      Object.entries(m.fixos || {}).forEach(([k, v]) => {
        const def = V1_FIXOS[k];
        if (def) addDespesa(novo.empresarial, Number(v), def[0], def[1]);
      });
      Object.entries(m.variaveis || {}).forEach(([k, v]) => {
        const def = V1_VARIAVEIS[k];
        if (def) addDespesa(novo.empresarial, Number(v), def[0], def[1]);
      });
      Object.entries(m.anuais || {}).forEach(([k, v]) => {
        const def = V1_ANUAIS[k];
        if (def && v > 0)
          addDespesa(novo.empresarial, Number(v) / 12, def[0] + " (anual ÷12)", def[1]);
      });
      // Faturamento
      const fat = m.dre && Number(m.dre.faturamento);
      if (fat > 0) {
        novo.empresarial.transacoes.push({
          id: uid(), tipo: "receita", data: dia15,
          categoriaId: catId(novo.empresarial, "Faturamento"),
          valor: fat, descricao: "Faturamento do mês", status: "ok",
        });
      }
    });
  return novo;
}

export function normalizarDados(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.versao === 2 && parsed.pessoal && parsed.empresarial) {
    const base = dadosVazios();
    return {
      versao: 2,
      pessoal: { ...base.pessoal, ...parsed.pessoal },
      empresarial: { ...base.empresarial, ...parsed.empresarial },
    };
  }
  if (parsed.months) return migrarV1(parsed); // formato antigo (planilhas)
  return null;
}
