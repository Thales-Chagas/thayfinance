import { uuidDeString } from "../cloudData";
import { hojeISO, somaDias, somaMeses } from "./formato";

/* ============================================================
   RECORRÊNCIA — contas que se repetem (aluguel, mensalidade...)
   Cada ocorrência é um lançamento REAL com o campo `recorrencia`:
   { grupo, tipo, cada, inicio, fim, n }. Assim dashboard, fluxo de
   caixa, notificações e Telegram enxergam as parcelas sem mudar nada.
   O id de cada ocorrência é DETERMINÍSTICO (série+parcela) — dois
   aparelhos gerando a mesma parcela convergem na nuvem sem duplicar.
   ============================================================ */

export const RECORRENCIAS = {
  diaria: { rotulo: "Diária", dias: 1 },
  semanal: { rotulo: "Semanal", dias: 7 },
  quinzenal: { rotulo: "Quinzenal", dias: 14 },
  mensal: { rotulo: "Mensal", meses: 1 },
  bimestral: { rotulo: "Bimestral", meses: 2 },
  trimestral: { rotulo: "Trimestral", meses: 3 },
  semestral: { rotulo: "Semestral", meses: 6 },
  anual: { rotulo: "Anual", meses: 12 },
  dias: { rotulo: "Personalizada" }, // a cada `cada` dias
};

export const REC_HORIZONTE_MESES = 12; // séries sem término ficam programadas até aqui
export const REC_MAX_GERACAO = 60;     // teto de parcelas criadas por série de uma vez

// Data da n-ésima ocorrência (n=0 é o primeiro vencimento, em `inicio`)
export function dataRecorrencia(regra, n) {
  const def = RECORRENCIAS[regra.tipo];
  if (!def) return null;
  if (def.meses) return somaMeses(regra.inicio, def.meses * n);
  const passo = def.dias || Math.max(1, Number(regra.cada) || 0);
  if (!passo) return null;
  return somaDias(regra.inicio, passo * n);
}

export const rotuloRecorrencia = (rec) =>
  rec.tipo === "dias" ? `A cada ${rec.cada} dias` : RECORRENCIAS[rec.tipo]?.rotulo || "Recorrente";

// Total de parcelas de uma série COM data final (null = sem término → não conta).
export function totalParcelas(regra) {
  if (!regra?.fim) return null;
  let n = 0;
  while (n < 3000) {
    const d = dataRecorrencia(regra, n);
    if (!d || d > regra.fim) break;
    n++;
  }
  return n || null;
}

export const menorData = (a, b) => (a && a < b ? a : b);

// Gera as ocorrências a partir da parcela `aPartirN`, copiando os campos do
// `modelo` (sem comprovante — cada parcela terá o seu). Para na data final,
// no horizonte de 12 meses ou no teto de segurança, o que vier primeiro.
// `idsExistentes` evita recriar uma parcela que já está na lista (ex.: uma
// futura que a pessoa já marcou como paga).
export function gerarProximasOcorrencias(modelo, regra, aPartirN, idsExistentes) {
  const horizonte = somaMeses(hojeISO(), REC_HORIZONTE_MESES);
  const limite = menorData(regra.fim, horizonte);
  const novas = [];
  for (let n = aPartirN; novas.length < REC_MAX_GERACAO; n++) {
    const data = dataRecorrencia(regra, n);
    if (!data || data > limite) break;
    const id = uuidDeString(`rec:${regra.grupo}:${regra.inicio}:${n}`);
    if (idsExistentes?.has(id)) continue;
    novas.push({
      id,
      tipo: modelo.tipo,
      data,
      valor: modelo.valor,
      descricao: modelo.descricao || "",
      categoriaId: modelo.categoriaId || "",
      clienteId: modelo.clienteId || "",
      fornecedorId: modelo.fornecedorId || "",
      centroCustoId: modelo.centroCustoId || "",
      status: "pendente",
      origem: modelo.origem || "manual",
      recorrencia: { ...regra, n },
    });
  }
  return novas;
}

// "Renova" as séries sem término: encontra a última parcela programada de
// cada série ativa e estende até o horizonte. Roda ao abrir o app; como os
// ids são determinísticos, rodar de novo (ou em outro aparelho) não duplica.
export function estenderRecorrencias(transacoes) {
  const ultimas = new Map(); // grupo -> parcela de maior n (carrega a regra vigente)
  for (const t of transacoes) {
    const g = t.recorrencia?.grupo;
    if (!g) continue;
    const atual = ultimas.get(g);
    if (!atual || (t.recorrencia.n ?? 0) > (atual.recorrencia.n ?? 0)) ultimas.set(g, t);
  }
  if (ultimas.size === 0) return [];
  const ids = new Set(transacoes.map((t) => t.id));
  const novas = [];
  for (const ref of ultimas.values()) {
    novas.push(...gerarProximasOcorrencias(ref, ref.recorrencia, (ref.recorrencia.n ?? 0) + 1, ids));
  }
  return novas;
}
