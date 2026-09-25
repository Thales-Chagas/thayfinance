import React, { useState } from "react";
import { TrendingUp, TrendingDown, PiggyBank, Printer, FileSpreadsheet } from "lucide-react";
import { MESES } from "../lib/constantes";
import { fmtBRL, fmtNum, fmtData, mesPrefixo, soma } from "../lib/formato";
import { escHtml, exportarPDF, exportarExcel } from "../lib/exportar";
import { Card, StatCard, SectionTitle, BotaoLeve } from "../components/ui";

/* ============================================================
   RELATÓRIOS
   ============================================================ */

export function PaginaRelatorios({ espaco, empresarial, ano, mesIdx, nomeApp }) {
  const [aba, setAba] = useState("mensal");
  const catNome = (id) => espaco.categorias.find((c) => c.id === id)?.nome || "Outros";
  const ts = espaco.transacoes.filter((t) => t.status === "ok");

  // ---- dados mensais ----
  const prefixo = mesPrefixo(ano, mesIdx);
  const doMes = ts.filter((t) => t.data.startsWith(prefixo));
  const recMes = soma(doMes.filter((t) => t.tipo === "receita"));
  const despMes = soma(doMes.filter((t) => t.tipo === "despesa"));
  const porCategoria = (lista, tipo) => {
    const r = {};
    lista.filter((t) => t.tipo === tipo).forEach((t) => {
      const n = catNome(t.categoriaId);
      r[n] = (r[n] || 0) + t.valor;
    });
    return Object.entries(r).sort((a, b) => b[1] - a[1]);
  };
  const recPorCat = porCategoria(doMes, "receita");
  const despPorCat = porCategoria(doMes, "despesa");

  // centro de custos (empresarial)
  const porCentro = {};
  if (empresarial) {
    doMes.filter((t) => t.tipo === "despesa").forEach((t) => {
      const n = espaco.centrosCusto.find((c) => c.id === t.centroCustoId)?.nome || "Sem centro";
      porCentro[n] = (porCentro[n] || 0) + t.valor;
    });
  }

  // ---- dados anuais ----
  // saldo que vem dos anos anteriores (carrega resultado, mesmo negativo)
  const saldoAnterior =
    soma(ts.filter((t) => t.tipo === "receita" && t.data < `${ano}-01-01`)) -
    soma(ts.filter((t) => t.tipo === "despesa" && t.data < `${ano}-01-01`));
  let acumulado = saldoAnterior;
  const anual = MESES.map((nome, i) => {
    const p = mesPrefixo(ano, i);
    const rec = soma(ts.filter((t) => t.tipo === "receita" && t.data.startsWith(p)));
    const desp = soma(ts.filter((t) => t.tipo === "despesa" && t.data.startsWith(p)));
    acumulado += rec - desp;
    return { nome, rec, desp, lucro: rec - desp, acumulado };
  });
  const totAnualRec = anual.reduce((a, m) => a + m.rec, 0);
  const totAnualDesp = anual.reduce((a, m) => a + m.desp, 0);

  function htmlTabela(cabecalho, linhas, totalLinha) {
    return `<table><thead><tr>${cabecalho.map((c, i) => `<th class="${i > 0 ? "num" : ""}">${escHtml(c)}</th>`).join("")}</tr></thead><tbody>${linhas
      .map((l) => `<tr>${l.map((c, i) => `<td class="${i > 0 ? "num" : ""}">${escHtml(c)}</td>`).join("")}</tr>`)
      .join("")}${totalLinha ? `<tr class="total">${totalLinha.map((c, i) => `<td class="${i > 0 ? "num" : ""}">${escHtml(c)}</td>`).join("")}</tr>` : ""}</tbody></table>`;
  }

  function exportar(formato) {
    const escopo = empresarial ? "Empresarial" : "Pessoal";
    if (aba === "mensal") {
      const titulo = `Relatório mensal — ${MESES[mesIdx]} de ${ano} (${escopo})`;
      if (formato === "pdf") {
        const corpo = `<h1>${nomeApp}</h1><p class="sub">${titulo}</p>
<h2>Resumo</h2>${htmlTabela(["", "Valor"], [["Receitas", fmtBRL(recMes)], ["Despesas", fmtBRL(despMes)]], ["Lucro líquido", fmtBRL(recMes - despMes)])}
<h2>Receitas por categoria</h2>${htmlTabela(["Categoria", "Valor"], recPorCat.map(([n, v]) => [n, fmtBRL(v)]), ["Total", fmtBRL(recMes)])}
<h2>Despesas por categoria</h2>${htmlTabela(["Categoria", "Valor"], despPorCat.map(([n, v]) => [n, fmtBRL(v)]), ["Total", fmtBRL(despMes)])}
${empresarial ? `<h2>Despesas por centro de custo</h2>${htmlTabela(["Centro de custo", "Valor"], Object.entries(porCentro).map(([n, v]) => [n, fmtBRL(v)]), null)}<h2>Lucro operacional</h2>${htmlTabela(["", "Valor"], [["Faturamento", fmtBRL(recMes)], ["Despesas operacionais", fmtBRL(despMes)]], ["Lucro operacional", fmtBRL(recMes - despMes)])}` : ""}`;
        exportarPDF(titulo, corpo);
      } else {
        const linhas = [
          [titulo], [],
          ["RESUMO"], ["Receitas", fmtNum(recMes)], ["Despesas", fmtNum(despMes)], ["Lucro líquido", fmtNum(recMes - despMes)], [],
          ["RECEITAS POR CATEGORIA"], ...recPorCat.map(([n, v]) => [n, fmtNum(v)]), [],
          ["DESPESAS POR CATEGORIA"], ...despPorCat.map(([n, v]) => [n, fmtNum(v)]),
        ];
        if (empresarial) {
          linhas.push([], ["DESPESAS POR CENTRO DE CUSTO"], ...Object.entries(porCentro).map(([n, v]) => [n, fmtNum(v)]));
        }
        linhas.push([], ["LANÇAMENTOS DO MÊS"], ["Data", "Tipo", "Categoria", "Descrição", "Valor"]);
        doMes
          .sort((a, b) => a.data.localeCompare(b.data))
          .forEach((t) =>
            linhas.push([fmtData(t.data), t.tipo === "receita" ? "Receita" : "Despesa", catNome(t.categoriaId), t.descricao || "", fmtNum(t.valor)])
          );
        exportarExcel(`relatorio-${escopo.toLowerCase()}-${prefixo}`, linhas);
      }
    } else {
      const titulo = `Relatório anual — ${ano} (${escopo})`;
      if (formato === "pdf") {
        const corpo = `<h1>${nomeApp}</h1><p class="sub">${titulo}</p>
${saldoAnterior !== 0 ? `<p class="sub">Saldo vindo dos anos anteriores: ${fmtBRL(saldoAnterior)}</p>` : ""}
${htmlTabela(["Mês", "Receitas", "Despesas", "Lucro", "Acumulado"], anual.map((m) => [m.nome, fmtBRL(m.rec), fmtBRL(m.desp), fmtBRL(m.lucro), fmtBRL(m.acumulado)]), ["Total", fmtBRL(totAnualRec), fmtBRL(totAnualDesp), fmtBRL(totAnualRec - totAnualDesp), fmtBRL(anual[11].acumulado)])}`;
        exportarPDF(titulo, corpo);
      } else {
        exportarExcel(`relatorio-${escopo.toLowerCase()}-${ano}`, [
          [titulo], [],
          ["Mês", "Receitas", "Despesas", "Lucro", "Acumulado"],
          ...anual.map((m) => [m.nome, fmtNum(m.rec), fmtNum(m.desp), fmtNum(m.lucro), fmtNum(m.acumulado)]),
          ["Total", fmtNum(totAnualRec), fmtNum(totAnualDesp), fmtNum(totAnualRec - totAnualDesp), fmtNum(anual[11].acumulado)],
        ]);
      }
    }
  }

  const TabelaCat = ({ titulo, dados, total, cor }) => (
    <Card>
      <SectionTitle right={<span className={"text-xs font-bold " + cor}>{fmtBRL(total)}</span>}>{titulo}</SectionTitle>
      {dados.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Nada neste mês.</p>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {dados.map(([n, v]) => (
            <div key={n} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{n}</span>
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">{fmtBRL(v)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {[["mensal", "Mensal"], ["anual", "Anual"]].map(([v, r]) => (
            <button
              key={v}
              onClick={() => setAba(v)}
              className={
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition " +
                (aba === v
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400")
              }
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <BotaoLeve onClick={() => exportar("pdf")}>
            <Printer size={14} /> PDF
          </BotaoLeve>
          <BotaoLeve onClick={() => exportar("excel")}>
            <FileSpreadsheet size={14} /> Excel
          </BotaoLeve>
        </div>
      </div>

      {aba === "mensal" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={TrendingUp} label="Receitas" value={fmtBRL(recMes)} />
            <StatCard icon={TrendingDown} label="Despesas" value={fmtBRL(despMes)} />
            <StatCard
              icon={PiggyBank}
              label={empresarial ? "Lucro operacional" : "Lucro líquido"}
              value={fmtBRL(recMes - despMes)}
              tone={recMes - despMes >= 0 ? "good" : "bad"}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TabelaCat titulo="Receitas por categoria" dados={recPorCat} total={recMes} cor="text-emerald-600" />
            <TabelaCat titulo="Despesas por categoria" dados={despPorCat} total={despMes} cor="text-red-500" />
          </div>
          {empresarial && Object.keys(porCentro).length > 0 && (
            <TabelaCat
              titulo="Despesas por centro de custo"
              dados={Object.entries(porCentro).sort((a, b) => b[1] - a[1])}
              total={despMes}
              cor="text-red-500"
            />
          )}
        </>
      ) : (
        <Card>
          <SectionTitle>Resultado de {ano}, mês a mês</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400 dark:border-slate-800">
                  <th className="py-2 pr-2">Mês</th>
                  <th className="py-2 pr-2 text-right">Receitas</th>
                  <th className="py-2 pr-2 text-right">Despesas</th>
                  <th className="py-2 pr-2 text-right">Lucro</th>
                  <th className="py-2 text-right">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {anual.map((m) => (
                  <tr key={m.nome}>
                    <td className="py-2 pr-2 text-slate-600 dark:text-slate-300">{m.nome}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-emerald-600">{m.rec ? fmtBRL(m.rec) : "—"}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-red-500">{m.desp ? fmtBRL(m.desp) : "—"}</td>
                    <td
                      className={
                        "py-2 pr-2 text-right font-medium tabular-nums " +
                        (m.lucro > 0 ? "text-emerald-600" : m.lucro < 0 ? "text-red-500" : "text-slate-400")
                      }
                    >
                      {m.rec || m.desp ? fmtBRL(m.lucro) : "—"}
                    </td>
                    <td
                      className={
                        "py-2 text-right font-semibold tabular-nums " +
                        (m.acumulado >= 0 ? "text-slate-700 dark:text-slate-200" : "text-red-500")
                      }
                    >
                      {fmtBRL(m.acumulado)}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2 pr-2 text-slate-700 dark:text-slate-200">Total</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-emerald-600">{fmtBRL(totAnualRec)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-red-500">{fmtBRL(totAnualDesp)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                    {fmtBRL(totAnualRec - totAnualDesp)}
                  </td>
                  <td
                    className={
                      "py-2 text-right tabular-nums " +
                      (anual[11].acumulado >= 0 ? "text-slate-700 dark:text-slate-200" : "text-red-500")
                    }
                  >
                    {fmtBRL(anual[11].acumulado)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            O "Acumulado" carrega o resultado de cada mês para o seguinte, mesmo quando negativo
            {saldoAnterior !== 0 ? `, incluindo ${fmtBRL(saldoAnterior)} vindos dos anos anteriores` : ""}.
          </p>
        </Card>
      )}
    </div>
  );
}
