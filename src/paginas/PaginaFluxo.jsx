import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MESES } from "../lib/constantes";
import { fmtBRL, hojeISO, fmtData, somaDias, soma } from "../lib/formato";
import { Card } from "../components/ui";

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
    if (t.status === "ok") acumulado = (Math.round(acumulado * 100) + (t.tipo === "receita" ? 1 : -1) * Math.round(t.valor * 100)) / 100;
    return { ...t, acumulado };
  });

  // No celular: lista por dia, com o saldo acumulado ao fim de cada dia
  const dias = [];
  for (const t of linhas) {
    const ult = dias[dias.length - 1];
    if (ult && ult.data === t.data) {
      ult.itens.push(t);
      ult.saldo = t.acumulado;
    } else dias.push({ data: t.data, itens: [t], saldo: t.acumulado });
  }
  const movimento = acumulado - saldoInicial;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 sm:flex-none" role="radiogroup" aria-label="Período">
          {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]].map(([v, r]) => (
            <button
              key={v}
              role="radio"
              aria-checked={periodo === v}
              onClick={() => setPeriodo(v)}
              className={
                "h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition sm:flex-none " +
                (periodo === v
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400")
              }
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex w-full items-center justify-between gap-1 sm:w-auto">
          <button onClick={() => navegar(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Período anterior">
            <ChevronLeft size={20} />
          </button>
          <span className="min-w-32 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">{rotulo}</span>
          <button onClick={() => navegar(1)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Próximo período">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Saldo inicial → movimento → saldo final */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Saldo inicial</span>
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{fmtBRL(saldoInicial)}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Movimento no período</span>
          <span className={"font-semibold tabular-nums " + (movimento >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {movimento > 0 ? "+" : movimento < 0 ? "−" : ""}
            {fmtBRL(Math.abs(movimento))}
          </span>
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Saldo final</span>
          <span className={"text-xl font-bold tabular-nums " + (acumulado >= 0 ? "text-slate-800 dark:text-slate-100" : "text-red-600 dark:text-red-400")}>
            {fmtBRL(acumulado)}
          </span>
        </div>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nenhum lançamento neste período.
        </p>
      ) : (
        <>
          {/* Celular: lista por dia */}
          <div className="space-y-4 md:hidden">
            {dias.map((d) => (
              <section key={d.data} aria-label={fmtData(d.data)}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{fmtData(d.data)}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    saldo{" "}
                    <b className={"tabular-nums " + (d.saldo >= 0 ? "text-slate-700 dark:text-slate-200" : "text-red-600 dark:text-red-400")}>{fmtBRL(d.saldo)}</b>
                  </span>
                </div>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                  {d.itens.map((t) => (
                    <li key={t.id} className={"flex min-h-14 items-center gap-3 px-4 py-2.5 " + (t.status === "pendente" ? "opacity-60" : "")}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-slate-800 dark:text-slate-100">{t.descricao || catNome(t.categoriaId)}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {catNome(t.categoriaId)}
                          {t.status === "pendente" && <span className="font-semibold text-amber-700 dark:text-amber-400"> · pendente, fora do saldo</span>}
                        </span>
                      </span>
                      <span className={"shrink-0 text-[15px] font-bold tabular-nums " + (t.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")}>
                        {t.tipo === "receita" ? "+" : "−"}
                        {fmtBRL(t.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* Computador: tabela */}
          <Card className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
                      {t.status === "pendente" && <span className="ml-1 text-xs text-amber-600">(pendente)</span>}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-emerald-600">{t.tipo === "receita" ? fmtBRL(t.valor) : ""}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-red-500">{t.tipo === "despesa" ? fmtBRL(t.valor) : ""}</td>
                    <td className="py-2 text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
                      {t.status === "ok" ? fmtBRL(t.acumulado) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );

}
