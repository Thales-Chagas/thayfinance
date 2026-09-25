import React, { useMemo, useState } from "react";
import { CalendarClock, Check, Plus, Pencil, Trash2, Repeat, ChevronLeft, ChevronRight, X } from "lucide-react";
import { MESES } from "../lib/constantes";
import { fmtBRL, hojeISO, fmtData, somaDias, soma, diasAte, rotuloDia } from "../lib/formato";
import { totalParcelas, rotuloRecorrencia } from "../lib/recorrencia";
import { gradPorId, gradCat, cssGrad } from "../lib/cores";
import { BotaoIcone } from "../components/ui";
import { ModalExcluirConta, ModalDetalheConta } from "../components/ModaisConta";

/* ============================================================
   CONTAS A PAGAR E RECEBER
   Resumo, calendário do mês com pontinhos nos dias de vencimento e a
   lista por urgência. "Paguei/Recebi" tem 44px e pode ser desfeito.
   Tocar na conta abre os detalhes (editar, excluir, parcelas).
   ============================================================ */

const FILTROS = [
  ["todas", "Todas"],
  ["vencidas", "Vencidas"],
  ["7dias", "Próximos 7 dias"],
  ["mes", "Este mês"],
  ["recorrentes", "Recorrentes"],
];

export function PaginaContas({ espaco, empresarial, acoes, abrirLancamento }) {
  const [tipo, setTipo] = useState("despesa"); // despesa = a pagar | receita = a receber
  const [filtro, setFiltro] = useState("todas");
  const [dia, setDia] = useState(null); // dia escolhido no calendário
  const [excluindo, setExcluindo] = useState(null);
  const [detalhe, setDetalhe] = useState(null);

  const hoje = hojeISO();
  const em7 = somaDias(hoje, 7);
  const [mesCal, setMesCal] = useState(() => hoje.slice(0, 7)); // "AAAA-MM" do calendário
  const catPorId = useMemo(() => new Map(espaco.categorias.map((c) => [c.id, c])), [espaco.categorias]);

  const pendentes = useMemo(() => espaco.transacoes.filter((t) => t.status === "pendente"), [espaco.transacoes]);
  const totalPagar = soma(pendentes.filter((t) => t.tipo === "despesa"));
  const totalReceber = soma(pendentes.filter((t) => t.tipo === "receita"));
  const doTipo = useMemo(() => pendentes.filter((t) => t.tipo === tipo).sort((a, b) => a.data.localeCompare(b.data)), [pendentes, tipo]);
  const vencidas = doTipo.filter((t) => t.data < hoje);
  const proximas7 = doTipo.filter((t) => t.data >= hoje && t.data <= em7);
  const recorrentes = new Set(doTipo.map((t) => t.recorrencia?.grupo).filter(Boolean)).size;

  const passaFiltro = (t) => {
    if (dia) return t.data === dia;
    if (filtro === "vencidas") return t.data < hoje;
    if (filtro === "7dias") return t.data >= hoje && t.data <= em7;
    if (filtro === "mes") return t.data.startsWith(hoje.slice(0, 7));
    if (filtro === "recorrentes") return !!t.recorrencia;
    return true;
  };
  const lista = doTipo.filter(passaFiltro);
  const secoes = [
    ["Vencidas", (t) => t.data < hoje, "text-red-600 dark:text-red-400"],
    ["Vence hoje", (t) => t.data === hoje, "text-amber-700 dark:text-amber-400"],
    ["Próximos 7 dias", (t) => t.data > hoje && t.data <= em7, "text-amber-700 dark:text-amber-400"],
    ["Mais adiante", (t) => t.data > em7, "text-slate-500 dark:text-slate-400"],
  ]
    .map(([rotulo, cond, cor]) => [rotulo, lista.filter(cond), cor])
    .filter(([, itens]) => itens.length > 0);

  // Parcelas (só séries com data final)
  function infoParcelas(t) {
    const rec = t.recorrencia;
    if (!rec?.fim) return null;
    const total = totalParcelas(rec);
    if (!total) return null;
    const n = rec.n ?? 0;
    return { posicao: n + 1, total, faltam: Math.max(1, total - n) };
  }

  const ehReceita = tipo === "receita";
  const novaConta = () => abrirLancamento({ tipo, statusPadrao: "pendente" });
  const chip = "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ";
  const chipOff = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
  const chipOn = "border-slate-800 bg-slate-800 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900";

  return (
    <div className="space-y-4">
      {/* Resumo: tocar troca entre a pagar e a receber */}
      <div className="grid grid-cols-2 gap-3" role="tablist" aria-label="Tipo de conta">
        {[
          ["despesa", "A pagar", totalPagar],
          ["receita", "A receber", totalReceber],
        ].map(([v, r, total]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tipo === v}
            onClick={() => {
              setTipo(v);
              setDia(null);
            }}
            className={
              "rounded-2xl border p-3.5 text-left transition " +
              (tipo === v
                ? "border-emerald-600 bg-white ring-1 ring-emerald-600 dark:bg-slate-900"
                : "border-slate-200 bg-white/60 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60")
            }
          >
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{r}</p>
            <p className={"mt-0.5 text-lg font-bold tabular-nums " + (v === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")}>
              {fmtBRL(total)}
            </p>
          </button>
        ))}
      </div>

      <Calendario
        mes={mesCal}
        setMes={setMesCal}
        contas={doTipo}
        hoje={hoje}
        dia={dia}
        onDia={(d) => setDia(d === dia ? null : d)}
      />

      {/* Filtros */}
      {dia ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-4 py-2 dark:bg-emerald-950/50">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            {rotuloDia(dia, hoje)} · {fmtData(dia)}
          </p>
          <button onClick={() => setDia(null)} className="flex h-10 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <X size={16} /> Ver todas
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {FILTROS.map(([v, r]) => {
            const n = v === "vencidas" ? vencidas.length : v === "7dias" ? proximas7.length : v === "recorrentes" ? recorrentes : null;
            return (
              <button key={v} aria-pressed={filtro === v} onClick={() => setFiltro(v)} className={chip + (filtro === v ? chipOn : chipOff)}>
                {r}
                {n ? <span className={"rounded-full px-1.5 text-xs " + (v === "vencidas" ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200")}>{n}</span> : null}
              </button>
            );
          })}
        </div>
      )}

      <div className="hidden md:block">
        <button onClick={novaConta} className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
          <Plus size={16} /> Nova conta {ehReceita ? "a receber" : "a pagar"}
        </button>
      </div>

      {/* Lista por urgência */}
      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <CalendarClock size={24} />
          </span>
          <p className="mt-3 text-base font-semibold text-slate-700 dark:text-slate-200">
            {dia ? "Nada vence neste dia" : filtro === "todas" ? `Nenhuma conta ${ehReceita ? "a receber" : "a pagar"}` : "Nada neste filtro"}
          </p>
          <button onClick={novaConta} className="mt-4 h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
            Adicionar conta {ehReceita ? "a receber" : "a pagar"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {secoes.map(([rotulo, itens, cor]) => (
            <section key={rotulo} aria-label={rotulo}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h3 className={"text-xs font-bold uppercase tracking-wide " + cor}>
                  {rotulo} · {itens.length}
                </h3>
                <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{fmtBRL(soma(itens))}</span>
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {itens.map((t) => (
                  <li key={t.id}>
                    <LinhaConta
                      t={t}
                      cat={catPorId.get(t.categoriaId)}
                      hoje={hoje}
                      onDetalhe={() => setDetalhe(t)}
                      onPagar={() => acoes.marcarOk(t.id)}
                      onEditar={() => abrirLancamento({ inicial: t })}
                      onExcluir={() => setExcluindo(t)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
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
          categoria={catPorId.get(detalhe.categoriaId) || null}
          parcelas={infoParcelas(detalhe)}
          onPagar={() => acoes.marcarOk(detalhe.id)}
          onEditar={() => abrirLancamento({ inicial: detalhe })}
          onExcluir={() => setExcluindo(detalhe)}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}

function LinhaConta({ t, cat, hoje, onDetalhe, onPagar, onEditar, onExcluir }) {
  const nome = t.descricao || cat?.nome || "Conta";
  const d = diasAte(t.data, hoje);
  const venc =
    d < 0
      ? { txt: d === -1 ? "Venceu ontem" : `Venceu há ${-d} dias`, cor: "text-red-600 dark:text-red-400 font-semibold" }
      : d === 0
      ? { txt: "Vence hoje", cor: "text-amber-700 dark:text-amber-400 font-semibold" }
      : d <= 7
      ? { txt: `Vence ${rotuloDia(t.data, hoje).toLowerCase()}`, cor: "text-amber-700 dark:text-amber-400 font-semibold" }
      : { txt: `Vence em ${fmtData(t.data)}`, cor: "text-slate-500 dark:text-slate-400" };
  const ehReceita = t.tipo === "receita";
  return (
    <div className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={onDetalhe}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-3.5 pr-1 text-left transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60"
        aria-label={`${nome}, ${fmtBRL(t.valor)}, ${venc.txt}. Ver detalhes`}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ background: cssGrad(cat ? gradCat(cat) : gradPorId("grafite")) }}
          aria-hidden
        >
          {(nome[0] || "?").toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">{nome}</span>
            <span className={"shrink-0 text-[15px] font-bold tabular-nums " + (ehReceita ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")}>
              {fmtBRL(t.valor)}
            </span>
          </span>
          <span className={"flex items-center gap-1.5 text-xs " + venc.cor}>
            {venc.txt}
            {t.recorrencia && (
              <span className="inline-flex items-center gap-0.5 font-medium text-slate-500 dark:text-slate-400">
                · <Repeat size={11} /> {rotuloRecorrencia(t.recorrencia)}
              </span>
            )}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onPagar}
        className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95 dark:bg-emerald-950 dark:text-emerald-300"
      >
        <Check size={16} /> {ehReceita ? "Recebi" : "Paguei"}
      </button>
      <span className="hidden md:flex">
        <BotaoIcone rotulo="Editar" onClick={onEditar}>
          <Pencil size={16} />
        </BotaoIcone>
        <BotaoIcone rotulo="Excluir" onClick={onExcluir} perigo>
          <Trash2 size={16} />
        </BotaoIcone>
      </span>
    </div>
  );
}

// Calendário do mês: pontinho nos dias com conta (vermelho = vencida).
function Calendario({ mes, setMes, contas, hoje, dia, onDia }) {
  const [y, m] = mes.split("-").map(Number);
  const primeiro = new Date(y, m - 1, 1);
  const diasNoMes = new Date(y, m, 0).getDate();
  const inicioSemana = (primeiro.getDay() + 6) % 7; // segunda = 0
  const porDia = useMemo(() => {
    const mapa = new Map();
    for (const t of contas) if (t.data.startsWith(mes)) mapa.set(t.data, [...(mapa.get(t.data) || []), t]);
    return mapa;
  }, [contas, mes]);
  const totalMes = soma(contas.filter((t) => t.data.startsWith(mes)));

  function passo(delta) {
    const d = new Date(y, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const celulas = [];
  for (let i = 0; i < inicioSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(`${mes}-${String(d).padStart(2, "0")}`);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900" aria-label="Calendário de vencimentos">
      <div className="mb-1 flex items-center justify-between">
        <BotaoIcone rotulo="Mês anterior" onClick={() => passo(-1)}>
          <ChevronLeft size={19} />
        </BotaoIcone>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {MESES[m - 1]} {y}
          </p>
          <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{totalMes ? `${fmtBRL(totalMes)} no mês` : "Nada no mês"}</p>
        </div>
        <BotaoIcone rotulo="Próximo mês" onClick={() => passo(1)}>
          <ChevronRight size={19} />
        </BotaoIcone>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400" aria-hidden>
        {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {celulas.map((iso, i) => {
          if (!iso) return <span key={"v" + i} />;
          const itens = porDia.get(iso);
          const vencida = itens && iso < hoje;
          const escolhido = iso === dia;
          const ehHoje = iso === hoje;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => itens && onDia(iso)}
              disabled={!itens}
              aria-pressed={escolhido}
              aria-label={`${Number(iso.slice(8))}${itens ? `, ${itens.length} conta${itens.length > 1 ? "s" : ""}, ${fmtBRL(soma(itens))}` : ""}`}
              className={
                "relative mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-xl text-sm tabular-nums transition " +
                (escolhido
                  ? "bg-emerald-600 font-bold text-white"
                  : itens
                  ? "font-semibold text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                  : "text-slate-400 dark:text-slate-600") +
                (ehHoje && !escolhido ? " ring-1 ring-emerald-500" : "")
              }
            >
              {Number(iso.slice(8))}
              {itens && (
                <span
                  className={"absolute bottom-1.5 h-1.5 w-1.5 rounded-full " + (escolhido ? "bg-white" : vencida ? "bg-red-500" : "bg-amber-500")}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
