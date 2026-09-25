import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { fmtBRL } from "../lib/formato";

// Gráfico de barras Entradas × Saídas (carregado sob demanda: o recharts
// só é baixado quando o gráfico aparece, não na abertura do app).
export default function GraficoEvolucao({ dados, escuro }) {
  const eixo = escuro ? "#94a3b8" : "#64748b";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={dados} margin={{ top: 6, right: 4, left: -14, bottom: 0 }} barGap={3}>
        <CartesianGrid stroke={escuro ? "#1e293b" : "#eef2f6"} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: eixo }} axisLine={false} tickLine={false} dy={4} />
        <YAxis
          tick={{ fontSize: 11, fill: eixo }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) => (v >= 1000 ? (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : v)}
        />
        <Tooltip
          cursor={{ fill: escuro ? "rgba(148,163,184,0.08)" : "rgba(100,116,139,0.07)", radius: 6 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{label}</p>
                {payload.map((p) => (
                  <p key={p.name} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                    {p.name}
                    <span className="ml-auto pl-3 font-semibold tabular-nums">{fmtBRL(p.value)}</span>
                  </p>
                ))}
              </div>
            ) : null
          }
        />
        <Bar dataKey="Entradas" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={18} />
        <Bar dataKey="Saídas" fill={escuro ? "#ef4444" : "#f87171"} radius={[5, 5, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
