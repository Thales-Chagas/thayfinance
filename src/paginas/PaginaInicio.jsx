import React, { Suspense, lazy, useMemo } from "react";
import { AlertTriangle, ChevronRight, Check, CalendarClock, TrendingUp, TrendingDown } from "lucide-react";
import { MESES, MESES_CURTO } from "../lib/constantes";
import { fmtBRL, hojeISO, mesPrefixo, somaDias, soma, rotuloDia, diasAte } from "../lib/formato";
import { gradCat, gradPorId, cssGrad } from "../lib/cores";
import { LinhaLancamento } from "./PaginaLancamentos";

const GraficoEvolucao = lazy(() => import("../components/GraficoEvolucao"));

/* ============================================================
   INÍCIO — o que a pessoa precisa saber primeiro:
   saldo, quanto entrou/saiu, o que vence, o que foi lançado.
   Gráficos vêm depois e menores.
   ============================================================ */

export function PaginaInicio({ espaco, empresarial, ano, mesIdx, escuro, irPara, acoes, abrirLancamento }) {
  const ts = espaco.transacoes;
  const hoje = hojeISO();
  const prefixo = mesPrefixo(ano, mesIdx);

  const r = useMemo(() => {
    // agrupa uma vez por mês (evita varrer a lista dezenas de vezes)
    const porMes = new Map();
    let saldoAte = 0;
    const fimMes = prefixo + "-31";
    for (const t of ts) {
      if (t.status !== "ok") continue;
      const m = t.data.slice(0, 7);
      if (!porMes.has(m)) porMes.set(m, { rec: [], desp: [] });
      porMes.get(m)[t.tipo === "receita" ? "rec" : "desp"].push(t);
      if (t.data <= fimMes) saldoAte += (t.tipo === "receita" ? 1 : -1) * Math.round(t.valor * 100);
    }
    const mesDe = (p) => porMes.get(p) || { rec: [], desp: [] };
    const atual = mesDe(prefixo);
    let pa = mesIdx - 1,
      py = ano;
    if (pa < 0) {
      pa = 11;
      py -= 1;
    }
    const anterior = mesDe(mesPrefixo(py, pa));
    const evolucao = [];
    for (let i = 5; i >= 0; i--) {
      let mi = mesIdx - i,
        y = ano;
      while (mi < 0) {
        mi += 12;
        y -= 1;
      }
      const m = mesDe(mesPrefixo(y, mi));
      evolucao.push({ name: MESES_CURTO[mi] + (y !== ano ? "/" + String(y).slice(2) : ""), Entradas: soma(m.rec), Saídas: soma(m.desp) });
    }
    // despesas por categoria no mês
    const porCat = new Map();
    for (const t of atual.desp) porCat.set(t.categoriaId, (porCat.get(t.categoriaId) || 0) + Math.round(t.valor * 100));
    const cats = [...porCat.entries()].map(([id, c]) => ({ id, valor: c / 100 })).sort((a, b) => b.valor - a.valor);
    return {
      saldo: saldoAte / 100,
      entrou: soma(atual.rec),
      saiu: soma(atual.desp),
      entrouAnt: soma(anterior.rec),
      saiuAnt: soma(anterior.desp),
      mesAnt: MESES_CURTO[pa],
      evolucao,
      cats,
    };
  }, [ts, prefixo, ano, mesIdx]);

  const resultado = r.entrou - r.saiu;
  const catPorId = useMemo(() => new Map(espaco.categorias.map((c) => [c.id, c])), [espaco.categorias]);

  // contas pendentes: vencidas primeiro, depois as próximas
  const pendentes = useMemo(() => ts.filter((t) => t.status === "pendente").sort((a, b) => a.data.localeCompare(b.data)), [ts]);
  const em7 = somaDias(hoje, 7);
  const vencidas = pendentes.filter((t) => t.data < hoje);
  const proximas7 = pendentes.filter((t) => t.data >= hoje && t.data <= em7);
  const proximasContas = pendentes.filter((t) => t.data <= somaDias(hoje, 30)).slice(0, 4);

  // últimos lançamentos do mês escolhido (até hoje)
  const ultimos = useMemo(
    () =>
      ts
        .filter((t) => t.data.startsWith(prefixo) && t.data <= hoje && t.status === "ok")
        .sort((a, b) => b.data.localeCompare(a.data))
        .slice(0, 5),
    [ts, prefixo, hoje]
  );

  const variacao = (atual, ant) => {
    if (!ant) return null;
    const p = Math.round(((atual - ant) / ant) * 100);
    return `${p >= 0 ? "+" : ""}${p}% vs ${r.mesAnt}`;
  };
  const totalAlerta = soma([...vencidas, ...proximas7].filter((t) => t.tipo === "despesa"));

  return (
    <div className="space-y-5">
      {/* Saldo */}
      <section className="rounded-3xl bg-emerald-700 p-5 text-white shadow-sm dark:bg-emerald-800" aria-label="Resumo do mês">
        <p className="text-sm font-medium text-emerald-100">Saldo até o fim de {MESES[mesIdx].toLowerCase()}</p>
        <p className={"mt-1 text-[2rem] font-bold leading-tight tracking-tight tabular-nums " + (r.saldo < 0 ? "text-red-100" : "")}>{fmtBRL(r.saldo)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
            <p className="flex items-center gap-1 text-xs font-medium text-emerald-100">
              <TrendingUp size={14} /> Entrou
            </p>
            <p className="mt-0.5 text-base font-bold tabular-nums">{fmtBRL(r.entrou)}</p>
            {variacao(r.entrou, r.entrouAnt) && <p className="text-xs text-emerald-100/90">{variacao(r.entrou, r.entrouAnt)}</p>}
          </div>
          <div className="rounded-2xl px-3.5 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
            <p className="flex items-center gap-1 text-xs font-medium text-emerald-100">
              <TrendingDown size={14} /> Saiu
            </p>
            <p className="mt-0.5 text-base font-bold tabular-nums">{fmtBRL(r.saiu)}</p>
            {variacao(r.saiu, r.saiuAnt) && <p className="text-xs text-emerald-100/90">{variacao(r.saiu, r.saiuAnt)}</p>}
          </div>
        </div>
        <p className="mt-3 text-sm text-emerald-50">
          {empresarial ? "Lucro" : "Resultado"} de {MESES[mesIdx].toLowerCase()}:{" "}
          <b className="tabular-nums">
            {resultado > 0 ? "+" : resultado < 0 ? "−" : ""}
            {fmtBRL(Math.abs(resultado))}
          </b>
        </p>
      </section>

      {/* Alerta de contas */}
      {(vencidas.length > 0 || proximas7.length > 0) && (
        <button
          onClick={() => irPara("contas")}
          className={
            "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition active:scale-[0.99] " +
            (vencidas.length
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200")
          }
        >
          <AlertTriangle size={20} className="shrink-0" />
          <span className="flex-1">
            {vencidas.length > 0 && `${vencidas.length} conta${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}`}
            {vencidas.length > 0 && proximas7.length > 0 && " · "}
            {proximas7.length > 0 && `${proximas7.length} vence${proximas7.length > 1 ? "m" : ""} em 7 dias`}
            {totalAlerta > 0 && <span className="block text-xs font-medium opacity-80">{fmtBRL(totalAlerta)} a pagar</span>}
          </span>
          <ChevronRight size={18} className="shrink-0" />
        </button>
      )}

      {/* Próximas contas */}
      <Bloco titulo="Próximas contas" acao="Ver agenda" onAcao={() => irPara("contas")}>
        {proximasContas.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
            <CalendarClock size={18} /> Nenhuma conta vencendo nos próximos 30 dias.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {proximasContas.map((t) => {
              const cat = catPorId.get(t.categoriaId);
              const d = diasAte(t.data, hoje);
              const nome = t.descricao || cat?.nome || "Conta";
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5 pl-3.5 pr-2">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ background: cssGrad(cat ? gradCat(cat) : gradPorId("grafite")) }}
                    aria-hidden
                  >
                    {(nome[0] || "?").toUpperCase()}
                  </span>
                  <button type="button" onClick={() => abrirLancamento({ inicial: t })} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">{nome}</span>
                    <span className={"block text-xs font-medium " + (d < 0 ? "text-red-600 dark:text-red-400" : d <= 7 ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")}>
                      {d < 0 ? `venceu ${d === -1 ? "ontem" : `há ${-d} dias`}` : d === 0 ? "vence hoje" : `vence ${rotuloDia(t.data, hoje).toLowerCase()}`}
                      {" · "}
                      <span className="tabular-nums">
                        {t.tipo === "receita" ? "+" : ""}
                        {fmtBRL(t.valor)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => acoes.marcarOk(t.id)}
                    className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95 dark:bg-emerald-950 dark:text-emerald-300"
                  >
                    <Check size={16} /> {t.tipo === "receita" ? "Recebi" : "Paguei"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Bloco>

      {/* Últimos lançamentos */}
      <Bloco titulo="Últimos lançamentos" acao="Ver todos" onAcao={() => irPara("lancamentos")}>
        {ultimos.length === 0 ? (
          <div className="px-4 py-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">Nada lançado em {MESES[mesIdx].toLowerCase()} ainda.</p>
            <button
              onClick={() => abrirLancamento({ tipo: "despesa" })}
              className="mt-3 h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Fazer o primeiro lançamento
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {ultimos.map((t) => (
              <li key={t.id}>
                <LinhaLancamento t={t} cat={catPorId.get(t.categoriaId)} onAbrir={() => abrirLancamento({ inicial: t })} />
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Evolução */}
        <Bloco titulo="Entradas e saídas · 6 meses">
          <div className="px-2 pb-3 pt-1">
            <div className="flex gap-4 px-2 pb-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Entradas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Saídas
              </span>
            </div>
            <div className="h-44">
              <Suspense fallback={<div className="h-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />}>
                <GraficoEvolucao dados={r.evolucao} escuro={escuro} />
              </Suspense>
            </div>
          </div>
        </Bloco>

        {/* Onde o dinheiro foi */}
        <Bloco titulo={`Despesas de ${MESES[mesIdx].toLowerCase()} por categoria`} acao="Relatório" onAcao={() => irPara("relatorios")}>
          {r.cats.length === 0 ? (
            <p className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">Sem despesas pagas neste mês.</p>
          ) : (
            <ul className="space-y-3 px-4 pb-4 pt-1">
              {r.cats.slice(0, 5).map((c) => {
                const cat = catPorId.get(c.id);
                const pct = r.saiu > 0 ? (c.valor / r.saiu) * 100 : 0;
                return (
                  <li key={c.id || "sem"}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">{cat?.nome || "Sem categoria"}</span>
                      <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                        {fmtBRL(c.valor)} <span className="text-xs text-slate-500">· {Math.round(pct)}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: cssGrad(cat ? gradCat(cat) : gradPorId("grafite")) }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>
      </div>
    </div>
  );
}

function Bloco({ titulo, acao, onAcao, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-h-12 items-center justify-between gap-2 pl-4 pr-1.5">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{titulo}</h2>
        {acao && (
          <button onClick={onAcao} className="flex h-11 items-center gap-0.5 rounded-xl px-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950">
            {acao} <ChevronRight size={16} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
