import React, { useState } from "react";
import { CalendarClock, Check, AlertTriangle, Plus, Pencil, Trash2, CircleCheck, Repeat, CalendarDays } from "lucide-react";
import { fmtBRL, hojeISO, fmtData, somaDias, soma } from "../lib/formato";
import { rotuloRecorrencia, totalParcelas } from "../lib/recorrencia";
import { gradPorId, gradCat, cssGrad } from "../lib/cores";
import { Card, SectionTitle, BotaoPrimario, BotaoLeve } from "../components/ui";
import { FormTransacao } from "../components/FormTransacao";
import { ModalExcluirConta, ModalDetalheConta } from "../components/ModaisConta";

export function PaginaContas({ espaco, empresarial, acoes }) {
  const [form, setForm] = useState(null); // null | {tipoNovo} | transacao p/ editar
  const [excluindo, setExcluindo] = useState(null); // transacao aguardando confirmação
  const [detalhe, setDetalhe] = useState(null); // transacao cujo popup de detalhes está aberto
  const [filtro, setFiltro] = useState("todas");

  const hoje = hojeISO();
  const em7 = somaDias(hoje, 7);
  const catDe = (id) => espaco.categorias.find((c) => c.id === id) || null;
  const catNome = (id) => catDe(id)?.nome || "—";
  const diasAte = (iso) =>
    Math.round((new Date(iso + "T12:00:00") - new Date(hoje + "T12:00:00")) / 86400000);

  const pendentes = espaco.transacoes.filter((t) => t.status === "pendente");
  const totalPagar = soma(pendentes.filter((t) => t.tipo === "despesa"));
  const totalReceber = soma(pendentes.filter((t) => t.tipo === "receita"));
  const vencidas = pendentes.filter((t) => t.data < hoje);
  const proximas7 = pendentes.filter((t) => t.data >= hoje && t.data <= em7);
  // séries ativas: grupos de recorrência que ainda têm parcela pendente
  const seriesAtivas = new Set(pendentes.map((t) => t.recorrencia?.grupo).filter(Boolean)).size;

  const FILTROS = [
    ["todas", "Todas"],
    ["vencidas", "Vencidas"],
    ["7dias", "Próximos 7 dias"],
    ["mes", "Este mês"],
    ["recorrentes", "Recorrentes"],
  ];
  const passaFiltro = (t) => {
    if (filtro === "vencidas") return t.data < hoje;
    if (filtro === "7dias") return t.data >= hoje && t.data <= em7;
    if (filtro === "mes") return t.data.startsWith(hoje.slice(0, 7));
    if (filtro === "recorrentes") return !!t.recorrencia;
    return true;
  };

  // rótulo de urgência da linha
  function rotuloVencimento(t) {
    const d = diasAte(t.data);
    if (d < 0) return { texto: d === -1 ? "Venceu ontem" : `Venceu há ${-d} dias`, cor: "font-semibold text-red-500" };
    if (d === 0) return { texto: "Vence hoje", cor: "font-semibold text-amber-500" };
    if (d <= 7) return { texto: `Vence em ${d} dia${d > 1 ? "s" : ""} · ${fmtData(t.data)}`, cor: "font-semibold text-amber-500" };
    return { texto: "Vence em " + fmtData(t.data), cor: "text-slate-500 dark:text-slate-400" };
  }

  // Info de parcelas p/ o popup: só quando a série tem data final (senão null).
  // posição = qual parcela é esta; faltam = quantas restam a partir desta.
  function infoParcelas(t) {
    const rec = t.recorrencia;
    if (!rec?.fim) return null;
    const total = totalParcelas(rec);
    if (!total) return null;
    const n = rec.n ?? 0;
    return { posicao: n + 1, total, faltam: Math.max(1, total - n) };
  }

  function Linha({ t }) {
    const cat = catDe(t.categoriaId);
    const grad = cat ? gradCat(cat) : gradPorId("grafite");
    const venc = rotuloVencimento(t);
    const nome = t.descricao || catNome(t.categoriaId);
    // Ações e valor aparecem DUAS vezes (celular embaixo, desktop na direita) —
    // uma some com hidden conforme o tamanho da tela.
    const acoesLinha = (
      <>
        <button
          onClick={() => acoes.marcarOk(t.id)}
          title={t.tipo === "receita" ? "Marcar como recebido" : "Marcar como pago"}
          className="flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
        >
          <Check size={13} />
          <span className="sm:inline">{t.tipo === "receita" ? "Recebi" : "Paguei"}</span>
        </button>
        <button
          onClick={() => setForm(t)}
          className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label="Editar"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => setExcluindo(t)}
          className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
          aria-label="Excluir"
        >
          <Trash2 size={15} />
        </button>
      </>
    );
    return (
      <div className="group flex items-start gap-2.5 py-2.5 sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={() => setDetalhe(t)}
          title="Ver detalhes"
          aria-label={"Ver detalhes de " + nome}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm outline-none ring-emerald-300 transition hover:brightness-110 focus-visible:ring-2 active:scale-95 sm:mt-0 dark:ring-emerald-700"
          style={{ background: cssGrad(grad) }}
        >
          {(nome[0] || "?").toUpperCase()}
        </button>
        <div className="min-w-0 flex-1">
          {/* celular: nome + valor lado a lado; desktop: só o nome (valor na direita) */}
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{nome}</p>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200 sm:hidden">
              {fmtBRL(t.valor)}
            </span>
          </div>
          <p className={"flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs " + venc.cor}>
            {venc.texto}
            {t.recorrencia && (
              <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Repeat size={10} /> {rotuloRecorrencia(t.recorrencia)}
              </span>
            )}
          </p>
          {/* celular: ações na linha de baixo, com respiro pro dedo */}
          <div className="mt-1.5 flex items-center gap-1 sm:hidden">{acoesLinha}</div>
        </div>
        <span className="hidden text-right text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200 sm:block">
          {fmtBRL(t.valor)}
        </span>
        <div className="hidden shrink-0 items-center gap-0.5 sm:flex">{acoesLinha}</div>
      </div>
    );
  }

  function Bloco({ tipo, titulo }) {
    const lista = espaco.transacoes
      .filter((t) => t.tipo === tipo && t.status === "pendente" && passaFiltro(t))
      .sort((a, b) => a.data.localeCompare(b.data));
    // agrupa por urgência — cada seção com seu tom
    const secoes = [
      ["Vencidas", (t) => t.data < hoje, "text-red-500"],
      ["Vence hoje", (t) => t.data === hoje, "text-amber-500"],
      ["Próximos 7 dias", (t) => t.data > hoje && t.data <= em7, "text-amber-500/90"],
      ["Mais adiante", (t) => t.data > em7, "text-slate-500 dark:text-slate-400"],
    ]
      .map(([rotulo, cond, cor]) => [rotulo, lista.filter(cond), cor])
      .filter(([, itens]) => itens.length > 0);
    const ehReceita = tipo === "receita";
    return (
      <Card>
        <SectionTitle
          right={
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {fmtBRL(soma(lista))}
            </span>
          }
        >
          {titulo}
        </SectionTitle>
        {lista.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="rounded-2xl bg-slate-100 p-3 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
              <CalendarClock size={24} />
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filtro === "todas" ? "Nada pendente por aqui. 🎉" : "Nada neste filtro."}
            </p>
            <button
              onClick={() => setForm({ tipoNovo: tipo })}
              className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              + Adicionar conta {ehReceita ? "a receber" : "a pagar"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {secoes.map(([rotulo, itens, cor]) => (
              <div key={rotulo}>
                <p className={"mb-0.5 text-xs font-semibold uppercase tracking-wide " + cor}>
                  {rotulo} · {itens.length}
                </p>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {itens.map((t) => (
                    <Linha key={t.id} t={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Painel-resumo com os totais pendentes e alertas */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-5 text-white sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-teal-300/10 blur-2xl" />
        <div className="relative">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-100/90">
            <CalendarClock size={13} /> Contas a pagar &amp; receber
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:max-w-md">
            <div>
              <p className="text-xs text-emerald-100/80">Total a pagar</p>
              <p className="mt-0.5 break-words text-xl font-bold tabular-nums sm:text-2xl">{fmtBRL(totalPagar)}</p>
            </div>
            <div>
              <p className="text-xs text-emerald-100/80">Total a receber</p>
              <p className="mt-0.5 break-words text-xl font-bold tabular-nums text-emerald-200 sm:text-2xl">
                {fmtBRL(totalReceber)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 text-xs font-semibold">
            {vencidas.length > 0 && (
              <button
                onClick={() => setFiltro("vencidas")}
                className="flex items-center gap-1 rounded-full bg-red-500/90 px-2.5 py-1 transition hover:bg-red-500"
              >
                <AlertTriangle size={11} /> {vencidas.length} vencida{vencidas.length > 1 ? "s" : ""}
              </button>
            )}
            {proximas7.length > 0 && (
              <button
                onClick={() => setFiltro("7dias")}
                className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 transition hover:bg-white/25"
              >
                <CalendarDays size={11} /> {proximas7.length} nos próximos 7 dias
              </button>
            )}
            {seriesAtivas > 0 && (
              <button
                onClick={() => setFiltro("recorrentes")}
                className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 transition hover:bg-white/25"
              >
                <Repeat size={11} /> {seriesAtivas} recorrência{seriesAtivas > 1 ? "s" : ""} ativa{seriesAtivas > 1 ? "s" : ""}
              </button>
            )}
            {vencidas.length === 0 && proximas7.length === 0 && pendentes.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                <CircleCheck size={11} /> Nada vencendo esta semana
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filtros + criação — no celular os filtros rolam de lado numa linha só */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:bg-slate-800 sm:flex-wrap sm:overflow-visible">
          {FILTROS.map(([v, r]) => (
            <button
              key={v}
              onClick={() => setFiltro(v)}
              className={
                "shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition " +
                (filtro === v
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400")
              }
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <BotaoLeve onClick={() => setForm({ tipoNovo: "receita" })} className="!border-emerald-200 !text-emerald-700 hover:!bg-emerald-50 dark:!border-emerald-800 dark:!text-emerald-300 dark:hover:!bg-emerald-950">
            <Plus size={14} /> A receber
          </BotaoLeve>
          <BotaoPrimario onClick={() => setForm({ tipoNovo: "despesa" })}>
            <Plus size={16} /> Nova conta a pagar
          </BotaoPrimario>
        </div>
      </div>

      {/* grid-cols-1 (minmax 0) impede o min-content das linhas de alargar a
          trilha no celular — sem ela o grid estoura a viewport e "deszooma" */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Bloco tipo="despesa" titulo="Contas a pagar" />
        <Bloco tipo="receita" titulo="Contas a receber" />
      </div>

      {form !== null && (
        <FormTransacao
          tipo={form.tipoNovo || form.tipo}
          inicial={form.id ? form : null}
          espaco={espaco}
          empresarial={empresarial}
          statusPadrao="pendente"
          onSalvar={acoes.salvar}
          onCriarCategoria={acoes.criarCategoria}
          onFechar={() => setForm(null)}
        />
      )}

      {excluindo && (
        <ModalExcluirConta
          transacao={excluindo}
          onExcluir={acoes.excluir}
          onExcluirSerie={acoes.excluirSerie}
          onFechar={() => setExcluindo(null)}
        />
      )}

      {detalhe && (
        <ModalDetalheConta
          transacao={detalhe}
          categoria={catDe(detalhe.categoriaId)}
          parcelas={infoParcelas(detalhe)}
          onPagar={() => acoes.marcarOk(detalhe.id)}
          onEditar={() => setForm(detalhe)}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}
