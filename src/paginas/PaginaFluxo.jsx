import React, { useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Wallet, PiggyBank } from "lucide-react";
import { MESES } from "../lib/constantes";
import { fmtBRL, hojeISO, fmtData, somaDias, soma } from "../lib/formato";
import { Card, StatCard } from "../components/ui";

/* ============================================================
   FLUXO DE CAIXA
   ============================================================ */

export function PaginaFluxo({ espaco }) {
  const [periodo, setPeriodo] = useState("mes");
  const [ref, setRef] = useState(hojeISO());
  const catNome = (id) => espaco.categorias.find((c) => c.id === id)?.nome || "—";

  // intervalo [inicio, fim] conforme o período
  const d = new Date(ref + "T12:00:00");
  let inicio, fim, rotulo;
  if (periodo === "dia") {
    inicio = fim = ref;
    rotulo = fmtData(ref);
  } else if (periodo === "semana") {
    const dow = (d.getDay() + 6) % 7; // segunda = 0
    inicio = somaDias(ref, -dow);
    fim = somaDias(inicio, 6);
    rotulo = `${fmtData(inicio)} a ${fmtData(fim)}`;
  } else if (periodo === "ano") {
    inicio = `${d.getFullYear()}-01-01`;
    fim = `${d.getFullYear()}-12-31`;
    rotulo = String(d.getFullYear());
  } else {
    const y = d.getFullYear(), m = d.getMonth();
    inicio = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    fim = `${y}-${String(m + 1).padStart(2, "0")}-31`;
    rotulo = `${MESES[m]} de ${y}`;
  }

  function navegar(delta) {
    if (periodo === "dia") setRef(somaDias(ref, delta));
    else if (periodo === "semana") setRef(somaDias(ref, delta * 7));
    else if (periodo === "ano") {
      const nd = new Date(d); nd.setFullYear(d.getFullYear() + delta);
      setRef(nd.toISOString().slice(0, 10));
    } else {
      const nd = new Date(d.getFullYear(), d.getMonth() + delta, 15);
      setRef(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-15`);
    }
  }

  const ordenadas = [...espaco.transacoes].sort((a, b) => a.data.localeCompare(b.data));
  const saldoInicial = soma(
    ordenadas.filter((t) => t.status === "ok" && t.data < inicio && t.tipo === "receita")
  ) - soma(ordenadas.filter((t) => t.status === "ok" && t.data < inicio && t.tipo === "despesa"));
  const noPeriodo = ordenadas.filter((t) => t.data >= inicio && t.data <= fim);
  let acumulado = saldoInicial;
  const linhas = noPeriodo.map((t) => {
    if (t.status === "ok") acumulado += t.tipo === "receita" ? t.valor : -t.valor;
    return { ...t, acumulado };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]].map(([v, r]) => (
            <button
              key={v}
              onClick={() => setPeriodo(v)}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition " +
                (periodo === v
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400")
              }
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navegar(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-32 text-center text-sm font-medium text-slate-600 dark:text-slate-300">{rotulo}</span>
          <button onClick={() => navegar(1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Próximo">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Wallet} label="Saldo inicial" value={fmtBRL(saldoInicial)} />
        <StatCard
          icon={ArrowLeftRight}
          label="Movimento"
          value={fmtBRL(acumulado - saldoInicial)}
          tone={acumulado - saldoInicial >= 0 ? "good" : "bad"}
        />
        <StatCard icon={PiggyBank} label="Saldo final" value={fmtBRL(acumulado)} tone={acumulado >= 0 ? "default" : "bad"} />
      </div>

      <Card>
        {linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Nenhum lançamento neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400 dark:border-slate-800">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Descrição</th>
                  <th className="py-2 pr-2 text-right">Entrada</th>
                  <th className="py-2 pr-2 text-right">Saída</th>
                  <th className="py-2 text-right">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {linhas.map((t) => (
                  <tr key={t.id} className={t.status === "pendente" ? "opacity-50" : ""}>
                    <td className="py-2 pr-2 tabular-nums text-slate-500">{fmtData(t.data)}</td>
                    <td className="py-2 pr-2 text-slate-700 dark:text-slate-200">
                      {t.descricao || catNome(t.categoriaId)}
                      {t.status === "pendente" && <span className="ml-1 text-xs text-amber-500">(pendente)</span>}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-emerald-600">
                      {t.tipo === "receita" ? fmtBRL(t.valor) : ""}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-red-500">
                      {t.tipo === "despesa" ? fmtBRL(t.valor) : ""}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
                      {t.status === "ok" ? fmtBRL(t.acumulado) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
