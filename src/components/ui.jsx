import React, { useState } from "react";
import { X } from "lucide-react";
import { fmtNum, parseBR } from "../lib/formato";
import { GRADIENTES, cssGrad } from "../lib/cores";

// Bolinhas de escolha de cor. `valor` = id escolhido (null = automática);
// `sugestao` = gradiente sugerido pelo nome (mostrado como ativo se nada foi
// escolhido). Passa onChange(null) ao re-clicar a ativa (volta pra automática).
export function SeletorGradiente({ valor, sugestao, onChange }) {
  const ativoId = valor || sugestao?.id;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {GRADIENTES.map((g) => {
        const ativo = ativoId === g.id;
        return (
          <button
            type="button"
            key={g.id}
            title={g.nome}
            aria-label={"Cor " + g.nome}
            onClick={() => onChange(valor === g.id ? null : g.id)}
            className={
              "h-7 w-7 rounded-full transition-transform " +
              (ativo
                ? "scale-110 ring-2 ring-slate-700 ring-offset-2 dark:ring-slate-200 dark:ring-offset-slate-900"
                : "hover:scale-110")
            }
            style={{ background: cssGrad(g) }}
          />
        );
      })}
    </div>
  );
}

/* ============================================================
   COMPONENTES BÁSICOS
   ============================================================ */

export function Card({ children, className = "" }) {
  return (
    <div
      className={
        "rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5 " +
        className
      }
    >
      {children}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, tone = "default" }) {
  const tones = {
    default: "text-slate-800 dark:text-slate-100",
    good: "text-emerald-600",
    bad: "text-red-600",
    warn: "text-amber-600",
  };
  return (
    <Card className="flex items-start gap-2.5 !p-3 sm:gap-3 sm:!p-5">
      <div className="hidden rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 sm:block">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">
          {label}
        </p>
        <p className={"mt-0.5 break-words text-base font-semibold leading-tight sm:text-xl " + tones[tone]}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {children}
      </h2>
      {right}
    </div>
  );
}

export function BotaoPrimario({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 " +
        className
      }
    >
      {children}
    </button>
  );
}

export function BotaoLeve({ children, onClick, className = "", title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 " +
        className
      }
    >
      {children}
    </button>
  );
}

export function CurrencyField({ value, onChange, className = "", placeholder = "0,00" }) {
  const [text, setText] = useState(null);
  const display = text !== null ? text : value ? fmtNum(value) : "";
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      onFocus={() => setText(value ? String(value).replace(".", ",") : "")}
      onChange={(e) => {
        const t = e.target.value;
        if (/^[\d.,\sR$]*$/.test(t)) setText(t);
      }}
      onBlur={(e) => {
        setText(null);
        const n = parseBR(e.target.value);
        if (n === null) return;
        onChange(Math.max(0, n));
      }}
      className={
        "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40 " +
        className
      }
    />
  );
}

export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40";

export function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Modal({ titulo, onFechar, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-slate-900 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{titulo}</h3>
          <button
            onClick={onFechar}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}


export function ChipStatus({ status, tipo }) {
  const ok = status === "ok";
  const rotulo = ok ? (tipo === "receita" ? "Recebido" : "Pago") : "Pendente";
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
        (ok
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400")
      }
    >
      {rotulo}
    </span>
  );
}
