import React from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet, PiggyBank } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { MESES, MESES_CURTO } from "../lib/constantes";
import { fmtBRL, hojeISO, mesPrefixo, somaDias, soma } from "../lib/formato";
import { gradPorId, gradCat, cssGrad } from "../lib/cores";
import { Card, StatCard, SectionTitle } from "../components/ui";

/* ============================================================
   DASHBOARD
   ============================================================ */

// Tooltip dos gráficos: cartão flutuante com bolinha colorida, ciente do tema
// escuro. `cores` mapeia série -> cor (barras); na rosca a cor vem do próprio
// dado (payload.gCss = gradiente da categoria).
export function TooltipGrafico({ active, payload, label, cores = {} }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      {label != null && <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 py-0.5 text-slate-500 dark:text-slate-400">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: p.payload?.gCss || cores[p.name] || p.color }}
          />
          <span className="font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-slate-700 dark:text-slate-100">{fmtBRL(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function PaginaDashboard({ espaco, ano, mesIdx, escuro, irPara }) {
  const ts = espaco.transacoes;
  const prefixo = mesPrefixo(ano, mesIdx);
  const doMes = ts.filter((t) => t.data.startsWith(prefixo));
  const receitasMes = soma(doMes.filter((t) => t.tipo === "receita" && t.status === "ok"));
  const despesasMes = soma(doMes.filter((t) => t.tipo === "despesa" && t.status === "ok"));
  const lucro = receitasMes - despesasMes;
  // saldo acumulado: tudo que entrou − saiu até o FIM do mês selecionado,
  // carregando o resultado (positivo ou negativo) para os meses seguintes
  const fimMes = prefixo + "-31";
  const saldoAcumulado =
    soma(ts.filter((t) => t.tipo === "receita" && t.status === "ok" && t.data <= fimMes)) -
    soma(ts.filter((t) => t.tipo === "despesa" && t.status === "ok" && t.data <= fimMes));

  // comparação com o mês anterior
  let pa = mesIdx - 1, py = ano;
  if (pa < 0) { pa = 11; py -= 1; }
  const prefAnt = mesPrefixo(py, pa);
  const recAnt = soma(ts.filter((t) => t.tipo === "receita" && t.status === "ok" && t.data.startsWith(prefAnt)));
  const despAnt = soma(ts.filter((t) => t.tipo === "despesa" && t.status === "ok" && t.data.startsWith(prefAnt)));
  const varPct = (atual, ant) =>
    ant > 0 ? `${atual >= ant ? "+" : ""}${(((atual - ant) / ant) * 100).toFixed(0)}% vs ${MESES_CURTO[pa]}` : null;

  // contas próximas do vencimento
  const hoje = hojeISO();
  const em7 = somaDias(hoje, 7);
  const pendentes = ts.filter((t) => t.status === "pendente");
  const vencidas = pendentes.filter((t) => t.data < hoje);
  const proximas = pendentes.filter((t) => t.data >= hoje && t.data <= em7);

  // gráfico de barras — últimos 6 meses
  const barData = [];
  for (let i = 5; i >= 0; i--) {
    let mi = mesIdx - i, y = ano;
    while (mi < 0) { mi += 12; y -= 1; }
    const p = mesPrefixo(y, mi);
    barData.push({
      name: MESES_CURTO[mi] + (y !== ano ? "/" + String(y).slice(2) : ""),
      Entradas: soma(ts.filter((t) => t.tipo === "receita" && t.status === "ok" && t.data.startsWith(p))),
      Saídas: soma(ts.filter((t) => t.tipo === "despesa" && t.status === "ok" && t.data.startsWith(p))),
    });
  }

  // rosca — despesas do mês por categoria, cada fatia com a COR da categoria
  const porCat = {};
  doMes
    .filter((t) => t.tipo === "despesa" && t.status === "ok")
    .forEach((t) => {
      const cat = espaco.categorias.find((c) => c.id === t.categoriaId) || null;
      const nome = cat?.nome || "Outros";
      if (!porCat[nome]) porCat[nome] = { value: 0, g: cat ? gradCat(cat) : gradPorId("grafite") };
      porCat[nome].value += t.valor;
    });
  const pieData = Object.entries(porCat)
    .map(([name, { value, g }]) => ({ name, value, g, gCss: cssGrad(g) }))
    .sort((a, b) => b.value - a.value);
  const totalPie = pieData.reduce((a, p) => a + p.value, 0);
  // gradientes únicos usados (viram <linearGradient> no SVG da rosca)
  const gradsPie = [...new Map(pieData.map((p) => [p.g.id, p.g])).values()];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Saldo acumulado"
          value={fmtBRL(saldoAcumulado)}
          tone={saldoAcumulado >= 0 ? "default" : "bad"}
          sub={`Tudo até ${MESES_CURTO[mesIdx]}/${ano}, mês a mês`}
        />
        <StatCard icon={TrendingUp} label="Receitas do mês" value={fmtBRL(receitasMes)} sub={varPct(receitasMes, recAnt)} />
        <StatCard icon={TrendingDown} label="Despesas do mês" value={fmtBRL(despesasMes)} sub={varPct(despesasMes, despAnt)} />
        <StatCard
          icon={PiggyBank}
          label="Lucro líquido"
          value={fmtBRL(lucro)}
          tone={lucro > 0 ? "good" : lucro < 0 ? "bad" : "default"}
          sub={`${MESES[mesIdx]} de ${ano}`}
        />
      </div>

      {(vencidas.length > 0 || proximas.length > 0) && (
        <button
          onClick={() => irPara("contas")}
          className="flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-700 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            {vencidas.length > 0 && (
              <b>
                {vencidas.length} conta{vencidas.length > 1 ? "s" : ""} vencida
                {vencidas.length > 1 ? "s" : ""}.{" "}
              </b>
            )}
            {proximas.length > 0 && (
              <>
                {proximas.length} conta{proximas.length > 1 ? "s" : ""} vence
                {proximas.length > 1 ? "m" : ""} nos próximos 7 dias.{" "}
              </>
            )}
            Toque para ver.
          </span>
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            right={
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "linear-gradient(180deg,#34d399,#059669)" }} />
                  Entradas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "linear-gradient(180deg,#f87171,#dc2626)" }} />
                  Saídas
                </span>
              </div>
            }
          >
            Entradas × Saídas (últimos 6 meses)
          </SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 5, left: -10, bottom: 0 }} barGap={5}>
                <defs>
                  <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={escuro ? "#1e293b" : "#f1f5f9"} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} dy={4} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? (v / 1000).toLocaleString("pt-BR") + "k" : v)}
                />
                <Tooltip
                  cursor={{ fill: escuro ? "rgba(148,163,184,0.07)" : "rgba(100,116,139,0.06)", radius: 8 }}
                  content={<TooltipGrafico cores={{ Entradas: "#10b981", Saídas: "#ef4444" }} />}
                />
                <Bar dataKey="Entradas" fill="url(#gradEntradas)" radius={[7, 7, 2, 2]} maxBarSize={26} />
                <Bar dataKey="Saídas" fill="url(#gradSaidas)" radius={[7, 7, 2, 2]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle>Despesas do mês por categoria</SectionTitle>
          {pieData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              Sem despesas pagas neste mês.
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
              {/* rosca com as cores das categorias + total no centro */}
              <div className="relative h-52 w-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {gradsPie.map((g) => (
                        <linearGradient key={g.id} id={"gradPie-" + g.id} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={g.de} />
                          <stop offset="100%" stopColor={g.para} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={pieData.length > 1 ? 3 : 0}
                      cornerRadius={6}
                      strokeWidth={0}
                    >
                      {pieData.map((p) => (
                        <Cell key={p.name} fill={`url(#gradPie-${p.g.id})`} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipGrafico />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Total</p>
                  <p className="max-w-[7.5rem] break-words text-center text-sm font-bold text-slate-700 dark:text-slate-100">
                    {fmtBRL(totalPie)}
                  </p>
                </div>
              </div>
              {/* legenda: bolinha gradiente + nome + % */}
              <div className="max-h-52 w-full flex-1 space-y-1 overflow-y-auto pr-1">
                {pieData.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.gCss }} />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-600 dark:text-slate-300">{p.name}</span>
                    <span className="tabular-nums text-slate-400">{((p.value / totalPie) * 100).toFixed(0)}%</span>
                    <span className="w-20 text-right font-semibold tabular-nums text-slate-600 dark:text-slate-200">{fmtBRL(p.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
