import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MESES, MESES_CURTO } from "../lib/constantes";
import { Sheet } from "./Sheet";

// Chip "‹ Set 2026 ›": setas de 44px para o mês vizinho; tocar no nome abre
// uma grade com os 12 meses e o ano (sem limite de anos).
export function SeletorMes({ ano, mesIdx, onMudar, compacto = false, largo = false }) {
  const [aberto, setAberto] = useState(false);
  const [anoGrade, setAnoGrade] = useState(ano);
  const hoje = new Date();

  function passo(delta) {
    let mi = mesIdx + delta,
      y = ano;
    if (mi < 0) {
      mi = 11;
      y -= 1;
    } else if (mi > 11) {
      mi = 0;
      y += 1;
    }
    onMudar(y, mi);
  }

  const seta =
    "flex h-11 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

  return (
    <>
      <div className={"flex items-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 " + (largo ? "w-full justify-between p-0.5" : "")}>
        <button type="button" onClick={() => passo(-1)} className={seta} aria-label="Mês anterior">
          <ChevronLeft size={19} />
        </button>
        <button
          type="button"
          onClick={() => {
            setAnoGrade(ano);
            setAberto(true);
          }}
          className={"h-11 min-w-[5.5rem] rounded-xl px-1.5 font-bold tabular-nums text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 " + (largo ? "flex-1 text-base" : "text-sm")}
          aria-label={`Mês: ${MESES[mesIdx]} de ${ano}. Tocar para escolher outro`}
        >
          {largo ? `${MESES[mesIdx]} de ${ano}` : compacto ? `${MESES_CURTO[mesIdx]} ${String(ano).slice(2)}` : `${MESES_CURTO[mesIdx]} ${ano}`}
        </button>
        <button type="button" onClick={() => passo(1)} className={seta} aria-label="Próximo mês">
          <ChevronRight size={19} />
        </button>
      </div>

      {aberto && (
        <Sheet titulo="Escolher mês" onFechar={() => setAberto(false)}>
          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={() => setAnoGrade((a) => a - 1)} className={seta} aria-label="Ano anterior">
              <ChevronLeft size={20} />
            </button>
            <span className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">{anoGrade}</span>
            <button type="button" onClick={() => setAnoGrade((a) => a + 1)} className={seta} aria-label="Próximo ano">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MESES.map((nome, i) => {
              const ativo = i === mesIdx && anoGrade === ano;
              const atual = i === hoje.getMonth() && anoGrade === hoje.getFullYear();
              return (
                <button
                  key={nome}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    onMudar(anoGrade, i);
                    setAberto(false);
                  }}
                  className={
                    "h-12 rounded-xl text-sm font-semibold transition " +
                    (ativo
                      ? "bg-emerald-600 text-white"
                      : atual
                      ? "border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700")
                  }
                >
                  {nome}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onMudar(hoje.getFullYear(), hoje.getMonth());
              setAberto(false);
            }}
            className="mt-4 h-12 w-full rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Voltar para o mês atual
          </button>
        </Sheet>
      )}
    </>
  );
}
