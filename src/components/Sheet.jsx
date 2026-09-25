import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/* ============================================================
   SHEET — painel que sobe de baixo no celular e vira diálogo
   centralizado a partir de 640px. Substitui o antigo Modal.
   - role="dialog" + aria-modal, título ligado por aria-labelledby
   - foco preso dentro do painel, Esc fecha, foco volta pra quem abriu
   - acompanha o teclado virtual (variáveis --vv-* do useTecladoVirtual)
   - `rodape` fica fixo embaixo (ex.: botão Salvar sempre visível)
   ============================================================ */

// Pilha de painéis abertos: só o de cima responde ao Esc/Tab.
const pilha = [];
let travas = 0;

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({ titulo, onFechar, children, rodape, largura = "sm:max-w-md", semTitulo = false }) {
  const idTitulo = useId();
  const painelRef = useRef(null);
  const fecharRef = useRef(onFechar);
  fecharRef.current = onFechar;

  useEffect(() => {
    const eu = {};
    pilha.push(eu);
    const anterior = document.activeElement;
    const painel = painelRef.current;
    // Foco inicial: se nenhum campo pegou foco sozinho (autoFocus), foca o painel
    // (assim o leitor de tela anuncia o título e o Tab começa aqui dentro).
    if (painel && !painel.contains(document.activeElement)) painel.focus({ preventScroll: true });

    // trava a rolagem da página de fundo
    if (travas++ === 0) document.documentElement.classList.add("trava-rolagem");

    function tecla(e) {
      if (pilha[pilha.length - 1] !== eu) return;
      if (e.key === "Escape") {
        e.preventDefault();
        fecharRef.current?.();
      } else if (e.key === "Tab" && painel) {
        const itens = [...painel.querySelectorAll(FOCAVEIS)].filter((el) => el.offsetParent !== null);
        if (itens.length === 0) return e.preventDefault();
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === painel)) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      const i = pilha.indexOf(eu);
      if (i >= 0) pilha.splice(i, 1);
      if (--travas === 0) document.documentElement.classList.remove("trava-rolagem");
      if (anterior && typeof anterior.focus === "function" && document.contains(anterior)) {
        anterior.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div className="sheet-camada fixed inset-x-0 top-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="anim-fade absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => fecharRef.current?.()} aria-hidden />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={semTitulo ? undefined : idTitulo}
        aria-label={semTitulo ? titulo : undefined}
        tabIndex={-1}
        className={
          "sheet-painel anim-sheet relative flex w-full flex-col rounded-t-3xl bg-white shadow-2xl outline-none dark:bg-slate-900 sm:rounded-3xl " +
          largura
        }
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden" aria-hidden />
        {!semTitulo && (
          <div className="flex shrink-0 items-center justify-between gap-2 px-5 pb-1 pt-2 sm:pt-4">
            <h2 id={idTitulo} className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={() => fecharRef.current?.()}
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 active:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">{children}</div>
        {rodape && (
          <div className="sheet-rodape shrink-0 border-t border-slate-100 bg-white px-5 pt-3 dark:border-slate-800 dark:bg-slate-900">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}

// Mantém --vv-altura (altura visível) e --vv-teclado (quanto o teclado cobre)
// no <html>. Com isso os painéis sobem junto com o teclado no iPhone e no
// Android, e o botão Salvar nunca fica escondido.
export function useTecladoVirtual() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const raiz = document.documentElement;
    let quadro = 0;
    function medir() {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const teclado = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        raiz.style.setProperty("--vv-altura", `${vv.height}px`);
        raiz.style.setProperty("--vv-topo", `${vv.offsetTop}px`);
        raiz.style.setProperty("--vv-teclado", `${teclado}px`);
        raiz.classList.toggle("teclado-aberto", teclado > 80);
      });
    }
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      cancelAnimationFrame(quadro);
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, []);
}
