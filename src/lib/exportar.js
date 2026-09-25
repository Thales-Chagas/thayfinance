

/* ============================================================
   EXPORTAÇÕES (PDF via impressão / Excel via CSV)
   ============================================================ */

// Escapa texto para inserir com segurança dentro de HTML. Usado na exportação
// de PDF (document.write numa janela do MESMO domínio): sem isso, um nome de
// categoria/descrição com "<img onerror=...>" viraria JS rodando no app.
export function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportarPDF(titulo, corpoHtml) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escHtml(titulo)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 18px 0 6px; }
  p.sub { color: #64748b; margin: 0 0 16px; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  td.num, th.num { text-align: right; }
  th { background: #f1f5f9; }
  tr.total td { font-weight: bold; background: #ecfdf5; }
</style></head><body>${corpoHtml}
<script>window.onload = function () { window.print(); };<\/script></body></html>`);
  w.document.close();
  return true;
}

// Evita "CSV formula injection": uma célula começando com = + @ (ou tab/CR)
// pode virar fórmula ao abrir no Excel. Prefixa com ' pra forçar texto.
// Números negativos ("-1.234,56") são preservados (- seguido de dígito).
export function protegerCsv(v) {
  let s = String(v ?? "");
  if (/^[=+@\t\r]/.test(s) || /^-(?!\d)/.test(s)) s = "'" + s;
  return s;
}

export function exportarExcel(nomeArquivo, linhas) {
  const csv =
    "﻿" +
    linhas
      .map((l) => l.map((c) => `"${protegerCsv(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
