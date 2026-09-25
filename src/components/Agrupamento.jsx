import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { fmtBRL } from "../lib/formato";
import { gradCat, gradPorId, cssGrad } from "../lib/cores";

// Preferência simples guardada no aparelho (ex.: agrupar por dia ou categoria)
export function usePreferencia(chave, padrao) {
  const [valor, setValor] = useState(() => {
    try {
      return localStorage.getItem(chave) || padrao;
    } catch {
      return padrao;
    }
  });
  const mudar = (v) => {
    setValor(v);
    try {
      localStorage.setItem(chave, v);
    } catch {
      /* sem armazenamento */
    }
  };
  return [valor, mudar];
}

// Alternância "Por dia | Por categoria"
export function SeletorAgrupamento({ valor, onMudar, opcoes }) {
  return (
    <div className="flex rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Agrupar lista">
      {opcoes.map(([v, r]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => onMudar(v)}
          className={
            "h-9 flex-1 rounded-lg px-3 text-sm font-semibold transition " +
            (valor === v ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")
          }
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// Bloco de uma categoria: cabeçalho com cor, quantidade e total; toque abre/fecha.
// `participacao` (0–1) desenha a barrinha de quanto essa categoria pesa no mês.
export function GrupoCategoria({ cat, quantidade, total, participacao, aberto, onAlternar, children }) {
  const grad = cat ? gradCat(cat) : gradPorId("grafite");
  const nome = cat?.nome || "Sem categoria";
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        className="flex min-h-16 w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: cssGrad(grad) }} aria-hidden>
          {(nome[0] || "?").toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-bold text-slate-800 dark:text-slate-100">{nome}</span>
            <span className={"shrink-0 text-[15px] font-bold tabular-nums " + (total > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")}>
              {total > 0 ? "+" : total < 0 ? "−" : ""}
              {fmtBRL(Math.abs(total))}
            </span>
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(3, Math.round((participacao || 0) * 100))}%`, background: cssGrad(grad) }} />
            </span>
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {quantidade} {quantidade === 1 ? "item" : "itens"}
            </span>
          </span>
        </span>
        <ChevronDown size={18} className={"shrink-0 text-slate-400 transition " + (aberto ? "rotate-180" : "")} />
      </button>
      {aberto && <div className="border-t border-slate-100 dark:border-slate-800">{children}</div>}
    </section>
  );
}
