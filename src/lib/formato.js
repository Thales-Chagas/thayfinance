

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

export const nfBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const nfNum = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtBRL = (v) => nfBRL.format(Number.isFinite(v) ? v : 0);
export const fmtNum = (v) => nfNum.format(Number.isFinite(v) ? v : 0);

export function parseBR(text) {
  const t = String(text).trim();
  if (t === "") return 0;
  let s = t.replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const fmtData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
export const mesPrefixo = (ano, mesIdx) => `${ano}-${String(mesIdx + 1).padStart(2, "0")}`;
export const somaDias = (iso, dias) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Soma meses mantendo o DIA do mês; quando o mês de destino é mais curto,
// encosta no último dia (31/01 + 1 mês = 28/02, mas 31/01 + 2 = 31/03,
// porque a série sempre parte da data inicial — o dia-âncora não "derrapa").
export const somaMeses = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const alvo = m - 1 + n;
  const ay = y + Math.floor(alvo / 12);
  const am = ((alvo % 12) + 12) % 12;
  const ad = Math.min(d, new Date(ay, am + 1, 0).getDate());
  return `${ay}-${String(am + 1).padStart(2, "0")}-${String(ad).padStart(2, "0")}`;
};

// Soma em centavos inteiros: evita o erro de ponto flutuante (0,1 + 0,2 ≠ 0,3)
// em somas longas. Os valores gravados continuam em reais com 2 casas.
export const emCentavos = (v) => Math.round((Number(v) || 0) * 100);
export const soma = (ts) => ts.reduce((a, t) => a + emCentavos(t.valor), 0) / 100;

// Leitura do campo de valor do lançamento. Aceita "86,40", "1.234,56",
// "1.234" (milhar), "12.5" e "R$ 50". Arredonda para centavos.
// Devolve null se não for número, 0 se vazio.
export function parseDinheiro(texto) {
  let s = String(texto ?? "").replace(/[R$\s]/g, "");
  if (s === "") return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d*\.?\d*$/.test(s) || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// "Hoje", "Ontem", "Amanhã" ou "qua, 23 set" (com o ano se for outro ano)
export function rotuloDia(iso, hoje = hojeISO()) {
  if (iso === hoje) return "Hoje";
  if (iso === somaDias(hoje, -1)) return "Ontem";
  if (iso === somaDias(hoje, 1)) return "Amanhã";
  const d = new Date(iso + "T12:00:00");
  const base = `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} ${MESES_ABREV[d.getMonth()]}`;
  return iso.slice(0, 4) === hoje.slice(0, 4) ? base : `${base} ${iso.slice(0, 4)}`;
}
// dias de hoje até a data (negativo = já passou)
export const diasAte = (iso, hoje = hojeISO()) =>
  Math.round((new Date(iso + "T12:00:00") - new Date(hoje + "T12:00:00")) / 86400000);
