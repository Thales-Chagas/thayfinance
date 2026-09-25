import React, { useState } from "react";
import { Check, Plus, Pencil, Trash2 } from "lucide-react";
import { uid, fmtBRL } from "../lib/formato";
import { gradientePorNome, cssGrad } from "../lib/cores";
import { Card, BotaoPrimario, CurrencyField, inputCls, Campo, Modal } from "../components/ui";

/* ============================================================
   METAS FINANCEIRAS
   ============================================================ */

// Anel de progresso circular com traço em gradiente (usado nas Metas).
export function AnelProgresso({ pct, g, completa }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, pct) / 100);
  const gid = "gradAnel-" + g.id;
  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={g.de} />
            <stop offset="100%" stopColor={g.para} />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          strokeWidth="8"
          stroke={`url(#${gid})`}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {completa ? (
          <span className="text-xl">🎉</span>
        ) : (
          <span className="text-sm font-bold text-slate-700 dark:text-slate-100">{Math.round(pct)}%</span>
        )}
      </div>
    </div>
  );
}

export function PaginaMetas({ espaco, atualizar }) {
  const [form, setForm] = useState(null);

  function FormMeta({ inicial, onFechar }) {
    const [m, setM] = useState(inicial || { nome: "", alvo: 0, atual: 0 });
    const [erro, setErro] = useState("");
    function salvar(e) {
      e.preventDefault();
      if (!m.nome.trim()) return setErro("Dê um nome para a meta.");
      if (!m.alvo || m.alvo <= 0) return setErro("Digite o valor objetivo.");
      atualizar((esp) => ({
        ...esp,
        metas: m.id
          ? esp.metas.map((x) => (x.id === m.id ? m : x))
          : [...esp.metas, { ...m, id: uid() }],
      }));
      onFechar();
    }
    return (
      <Modal titulo={inicial ? "Editar meta" : "Nova meta"} onFechar={onFechar}>
        <form onSubmit={salvar} className="space-y-3">
          <Campo label="Nome da meta">
            <input
              type="text"
              value={m.nome}
              onChange={(e) => setM({ ...m, nome: e.target.value })}
              placeholder="Ex.: Reserva de emergência, viagem..."
              className={inputCls}
              autoFocus
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor objetivo (R$)">
              <CurrencyField value={m.alvo} onChange={(v) => setM({ ...m, alvo: v })} className="!w-full" />
            </Campo>
            <Campo label="Valor atual (R$)">
              <CurrencyField value={m.atual} onChange={(v) => setM({ ...m, atual: v })} className="!w-full" />
            </Campo>
          </div>
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          <BotaoPrimario className="w-full justify-center">
            <Check size={16} /> Salvar
          </BotaoPrimario>
        </form>
      </Modal>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BotaoPrimario onClick={() => setForm({})}>
          <Plus size={16} /> Nova meta
        </BotaoPrimario>
      </div>
      {espaco.metas.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <p className="mb-1 text-3xl">🎯</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-300">Nenhuma meta ainda</p>
            <p className="mt-1 text-xs text-slate-400">
              Crie uma meta de economia — uma viagem, uma reserva, um sonho — e acompanhe o progresso aqui.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {espaco.metas.map((m) => {
            const pct = m.alvo > 0 ? Math.min(100, (m.atual / m.alvo) * 100) : 0;
            const completa = pct >= 100;
            const g = gradientePorNome(m.nome); // cor automática pelo nome, igual às categorias
            const falta = Math.max(0, m.alvo - m.atual);
            return (
              <div
                key={m.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
              >
                {/* filete gradiente no topo, como nas categorias */}
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: cssGrad(g) }} />
                <div className="flex items-center gap-4">
                  <AnelProgresso pct={pct} g={g} completa={completa} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{m.nome}</p>
                    <p className="mt-1 text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">
                      {fmtBRL(m.atual)}
                      <span className="ml-1 text-xs font-normal text-slate-400">de {fmtBRL(m.alvo)}</span>
                    </p>
                    {completa ? (
                      <span
                        className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                        style={{ background: cssGrad(g) }}
                      >
                        Meta alcançada! 🎉
                      </span>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">
                        Faltam <b className="text-slate-500 dark:text-slate-300">{fmtBRL(falta)}</b>
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-0.5 opacity-60 transition group-hover:opacity-100">
                    <button
                      onClick={() => setForm(m)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Excluir esta meta?"))
                          atualizar((esp) => ({ ...esp, metas: esp.metas.filter((x) => x.id !== m.id) }));
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                      aria-label="Excluir"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {form !== null && <FormMeta inicial={form.id ? form : null} onFechar={() => setForm(null)} />}
    </div>
  );
}
