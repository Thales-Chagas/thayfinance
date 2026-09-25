

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

export const soma = (ts) => ts.reduce((a, t) => a + (Number(t.valor) || 0), 0);
