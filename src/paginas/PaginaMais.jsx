import React, { useMemo } from "react";
import { ArrowLeftRight, Target, FileText, Tags, Users, Truck, FolderOpen, ChevronRight } from "lucide-react";
import { fmtBRL, hojeISO, soma } from "../lib/formato";

/* ============================================================
   MAIS — as ferramentas de finanças (planejar, analisar, organizar).
   Perfil e configurações ficam em outra tela (foto no topo).
   Cada cartão mostra um número útil, pra ninguém entrar às cegas.
   ============================================================ */

export function PaginaMais({ espaco, modo, irPara }) {
  const empresarial = modo === "empresarial";
  const hoje = hojeISO();

  const resumo = useMemo(() => {
    const ok = espaco.transacoes.filter((t) => t.status === "ok" && t.data <= hoje);
    const saldo = soma(ok.filter((t) => t.tipo === "receita")) - soma(ok.filter((t) => t.tipo === "despesa"));
    const metas = espaco.metas || [];
    const concluidas = metas.filter((m) => m.alvo > 0 && m.atual >= m.alvo).length;
    return { saldo, metas: metas.length, concluidas };
  }, [espaco, hoje]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Secao titulo="Planejar">
        <Cartao
          icone={Target}
          cor="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
          titulo="Metas"
          detalhe={resumo.metas ? `${resumo.metas} meta${resumo.metas > 1 ? "s" : ""} · ${resumo.concluidas} alcançada${resumo.concluidas !== 1 ? "s" : ""}` : "Crie uma reserva ou objetivo"}
          onClick={() => irPara("metas")}
        />
        <Cartao
          icone={ArrowLeftRight}
          cor="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          titulo="Fluxo de caixa"
          detalhe={`Saldo hoje ${fmtBRL(resumo.saldo)}`}
          onClick={() => irPara("fluxo")}
        />
      </Secao>

      <Secao titulo="Analisar e organizar">
        <Cartao
          icone={FileText}
          cor="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          titulo="Relatórios"
          detalhe="Mensal e anual, em PDF ou Excel"
          onClick={() => irPara("relatorios")}
        />
        <Cartao
          icone={Tags}
          cor="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          titulo="Categorias"
          detalhe={`${espaco.categorias.length} categorias · nomes e cores`}
          onClick={() => irPara("categorias")}
        />
      </Secao>

      {empresarial && (
        <Secao titulo="Empresa">
          <Cartao icone={Users} cor="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" titulo="Clientes" detalhe={`${espaco.clientes.length} cadastrados`} onClick={() => irPara("clientes")} />
          <Cartao icone={Truck} cor="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" titulo="Fornecedores" detalhe={`${espaco.fornecedores.length} cadastrados`} onClick={() => irPara("fornecedores")} />
          <Cartao icone={FolderOpen} cor="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" titulo="Centros de custo" detalhe={`${espaco.centrosCusto.length} cadastrados`} onClick={() => irPara("centros")} />
        </Secao>
      )}
    </div>
  );
}

function Secao({ titulo, children }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h2>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Cartao({ icone: Icone, cor, titulo, detalhe, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <span className="flex w-full items-start justify-between">
        <span className={"flex h-10 w-10 items-center justify-center rounded-xl " + cor}>
          <Icone size={20} />
        </span>
        <ChevronRight size={18} className="text-slate-300 transition group-hover:text-slate-500 dark:text-slate-600" />
      </span>
      <span className="block">
        <span className="block text-base font-bold text-slate-800 dark:text-slate-100">{titulo}</span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">{detalhe}</span>
      </span>
    </button>
  );
}
