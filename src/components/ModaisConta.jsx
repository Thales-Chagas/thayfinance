import React from "react";
import { Check, Pencil, Repeat } from "lucide-react";
import { fmtBRL, hojeISO, fmtData } from "../lib/formato";
import { rotuloRecorrencia } from "../lib/recorrencia";
import { gradPorId, gradCat, cssGrad } from "../lib/cores";
import { Modal } from "./ui";

/* ============================================================
   CONTAS A PAGAR E RECEBER
   ============================================================ */

// Confirmação de exclusão que entende recorrência: numa conta de série,
// oferece "só esta" ou "esta e as próximas" (as já pagas ficam guardadas).
export function ModalExcluirConta({ transacao, onExcluir, onExcluirSerie, onFechar }) {
  const ehSerie = !!transacao.recorrencia;
  return (
    <Modal titulo="Excluir lançamento" onFechar={onFechar}>
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {transacao.descricao || "Lançamento"} · {fmtBRL(transacao.valor)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            {fmtData(transacao.data)}
            {ehSerie && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Repeat size={11} /> {rotuloRecorrencia(transacao.recorrencia)}
              </span>
            )}
          </p>
        </div>
        {ehSerie && (
          <p className="text-xs leading-relaxed text-slate-400">
            Esta conta faz parte de uma repetição. Você pode excluir só ela ou também todas as
            próximas ainda pendentes — o que já foi pago ou recebido fica guardado.
          </p>
        )}
        <div className="space-y-2">
          <button
            onClick={() => {
              onExcluir(transacao.id);
              onFechar();
            }}
            className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            {ehSerie ? "Excluir só esta" : "Sim, excluir"}
          </button>
          {ehSerie && (
            <button
              onClick={() => {
                onExcluirSerie(transacao.id);
                onFechar();
              }}
              className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Excluir esta e as próximas
            </button>
          )}
          <button
            onClick={onFechar}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Popup de detalhes de uma conta (abre ao tocar no logo da categoria):
// descrição completa, categoria, vencimento, dados da recorrência e — só
// quando a série tem data final — quantas parcelas faltam.
export function ModalDetalheConta({ transacao, categoria, parcelas, onPagar, onEditar, onFechar }) {
  const t = transacao;
  const grad = categoria ? gradCat(categoria) : gradPorId("grafite");
  const ehReceita = t.tipo === "receita";
  const rec = t.recorrencia;
  const nome = t.descricao || categoria?.nome || "Lançamento";

  const hoje = hojeISO();
  const dias = Math.round((new Date(t.data + "T12:00:00") - new Date(hoje + "T12:00:00")) / 86400000);
  const vencTxt =
    dias < 0 ? (dias === -1 ? "Venceu ontem" : `Venceu há ${-dias} dias`)
    : dias === 0 ? "Vence hoje"
    : `Faltam ${dias} dia${dias > 1 ? "s" : ""}`;
  const vencCor = dias < 0 ? "text-red-500" : dias <= 7 ? "text-amber-500" : "text-slate-400";

  const Info = ({ rotulo, children }) => (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">{rotulo}</span>
      <span className="text-right text-sm font-medium text-slate-700 dark:text-slate-200">{children}</span>
    </div>
  );

  return (
    <Modal titulo="Detalhes da conta" onFechar={onFechar}>
      <div className="space-y-4">
        {/* cabeçalho: avatar grande + nome completo + valor */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm"
            style={{ background: cssGrad(grad) }}
          >
            {(nome[0] || "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="break-words text-base font-bold leading-snug text-slate-800 dark:text-slate-100">
              {nome}
            </p>
            <p
              className={
                "text-2xl font-bold tabular-nums " +
                (ehReceita ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")
              }
            >
              {fmtBRL(t.valor)}
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <Info rotulo="Tipo">{ehReceita ? "A receber" : "A pagar"}</Info>
          <Info rotulo="Categoria">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cssGrad(grad) }} />
              {categoria?.nome || "—"}
            </span>
          </Info>
          <Info rotulo="Vencimento">
            <span className="flex flex-col items-end">
              <span className="tabular-nums">{fmtData(t.data)}</span>
              <span className={"text-xs font-semibold " + vencCor}>{vencTxt}</span>
            </span>
          </Info>
          {rec && (
            <Info rotulo="Repetição">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Repeat size={11} /> {rotuloRecorrencia(rec)}
              </span>
            </Info>
          )}
          {rec?.inicio && <Info rotulo="Início da série"><span className="tabular-nums">{fmtData(rec.inicio)}</span></Info>}
          {rec?.fim && <Info rotulo="Termina em"><span className="tabular-nums">{fmtData(rec.fim)}</span></Info>}
          {/* parcelas: só quando a série tem data final (sem fim = nada aqui) */}
          {parcelas && (
            <Info rotulo="Parcelas">
              <span className="flex flex-col items-end">
                <span>Parcela {parcelas.posicao} de {parcelas.total}</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {parcelas.faltam <= 1 ? "última parcela" : `faltam ${parcelas.faltam} parcelas`}
                </span>
              </span>
            </Info>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { onEditar(); onFechar(); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Pencil size={15} /> Editar
          </button>
          <button
            onClick={() => { onPagar(); onFechar(); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Check size={15} /> {ehReceita ? "Recebi" : "Paguei"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
