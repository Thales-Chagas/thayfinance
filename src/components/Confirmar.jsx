import React, { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Sheet } from "./Sheet";

/* ============================================================
   CONFIRMAÇÃO dentro do app (substitui window.confirm).
   Uso:  const confirmar = useConfirmar();
         if (!(await confirmar({ titulo, mensagem, confirmar: "Excluir", perigo: true }))) return;
   ============================================================ */

const Ctx = createContext(null);

export function ConfirmProvider({ children }) {
  const [pedido, setPedido] = useState(null);

  const confirmar = useCallback(
    (opcoes) =>
      new Promise((resolve) => {
        setPedido({ cancelar: "Cancelar", confirmar: "Confirmar", ...opcoes, resolve });
      }),
    [],
  );

  function responder(valor) {
    pedido?.resolve(valor);
    setPedido(null);
  }

  return (
    <Ctx.Provider value={confirmar}>
      {children}
      {pedido && (
        <Sheet
          titulo={pedido.titulo}
          onFechar={() => responder(false)}
          rodape={
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => responder(false)}
                className="h-12 flex-1 rounded-xl border border-slate-200 text-base font-semibold text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:text-sm"
              >
                {pedido.cancelar}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => responder(true)}
                className={
                  "h-12 flex-1 rounded-xl text-base font-semibold text-white transition sm:text-sm " +
                  (pedido.perigo ? "bg-red-600 hover:bg-red-700 active:bg-red-800" : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800")
                }
              >
                {pedido.confirmar}
              </button>
            </div>
          }
        >
          <div className="flex items-start gap-3">
            {pedido.perigo && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
                <AlertTriangle size={18} />
              </span>
            )}
            <p className="whitespace-pre-line text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">
              {pedido.mensagem}
            </p>
          </div>
        </Sheet>
      )}
    </Ctx.Provider>
  );
}

// Fora do provider (ex.: testes) cai no confirm do navegador.
export function useConfirmar() {
  return useContext(Ctx) || (async ({ mensagem }) => window.confirm(mensagem));
}
