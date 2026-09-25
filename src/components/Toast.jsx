import React from "react";
import { Check, AlertTriangle } from "lucide-react";

// Aviso rápido no rodapé. A região aria-live fica sempre montada (vazia quando
// não há aviso) para o leitor de tela anunciar "Salvo", "Excluído" etc.
// `toast.acao` = { rotulo, fn } mostra um botão (ex.: "Desfazer").
export function Toast({ toast, onFechar }) {
  return (
    <div className="toast-pos pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      {toast && (
        <div
          key={toast.id}
          className={
            "anim-toast pointer-events-auto flex min-h-12 max-w-md items-center gap-3 rounded-2xl py-2 pl-4 pr-2 text-base font-medium text-white shadow-lg sm:text-sm " +
            (toast.isError ? "bg-red-600" : "bg-slate-800 dark:bg-slate-700")
          }
        >
          {toast.isError ? <AlertTriangle size={18} className="shrink-0" /> : <Check size={18} className="shrink-0 text-emerald-300" />}
          <span className="py-1.5">{toast.msg}</span>
          {toast.acao ? (
            <button
              type="button"
              onClick={() => {
                toast.acao.fn();
                onFechar();
              }}
              className="ml-1 h-10 shrink-0 rounded-xl px-3 font-bold text-emerald-300 transition hover:bg-white/10 active:bg-white/20"
            >
              {toast.acao.rotulo}
            </button>
          ) : (
            <span className="pr-2" />
          )}
        </div>
      )}
    </div>
  );
}
