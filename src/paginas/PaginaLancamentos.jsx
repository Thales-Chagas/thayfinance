import React, { useMemo, useState } from "react";
import { Plus, Search, X, Pencil, Copy, Check, Clock, Trash2, Image as ImageIcon, Repeat, ChevronDown, Paperclip } from "lucide-react";
import { MESES } from "../lib/constantes";
import { fmtBRL, fmtData, hojeISO, mesPrefixo, soma, rotuloDia } from "../lib/formato";
import { rotuloRecorrencia } from "../lib/recorrencia";
import { gradCat, gradPorId, cssGrad } from "../lib/cores";
import { agruparPorDia, agruparPorCategoria, filtrarBusca } from "../lib/transacoes";
import { usePreferencia, SeletorAgrupamento, GrupoCategoria } from "../components/Agrupamento";
import { Sheet } from "../components/Sheet";
import { ModalExcluirConta } from "../components/ModaisConta";

/* ============================================================
   LANÇAMENTOS — receitas e despesas numa lista só, por dia.
   Toque na linha abre as ações (editar, duplicar, pago/pendente,
   comprovante, excluir). Busca e filtros no topo.
   ============================================================ */

export function PaginaLancamentos({ espaco, empresarial, ano, mesIdx, acoes, abrirLancamento, filtroInicial = "tudo" }) {
  const [filtro, setFiltro] = useState(filtroInicial); // tudo | despesa | receita | pendente
  const [catFiltro, setCatFiltro] = useState(null);
  const [busca, setBusca] = useState("");
  const [escolhendoCat, setEscolhendoCat] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [excluindoSerie, setExcluindoSerie] = useState(null);
  const [verComprovante, setVerComprovante] = useState(null);

  const hoje = hojeISO();
  const prefixo = mesPrefixo(ano, mesIdx);
  const catPorId = useMemo(() => new Map(espaco.categorias.map((c) => [c.id, c])), [espaco.categorias]);
  const catNome = (id) => catPorId.get(id)?.nome || "Sem categoria";
  const rotReceita = empresarial ? "Entradas" : "Receitas";

  const doMes = useMemo(() => espaco.transacoes.filter((t) => t.data.startsWith(prefixo)), [espaco.transacoes, prefixo]);
  const entrou = soma(doMes.filter((t) => t.tipo === "receita" && t.status === "ok"));
  const saiu = soma(doMes.filter((t) => t.tipo === "despesa" && t.status === "ok"));
  const pendentes = doMes.filter((t) => t.status === "pendente");

  const lista = useMemo(() => {
    let l = doMes;
    if (filtro === "despesa" || filtro === "receita") l = l.filter((t) => t.tipo === filtro);
    if (filtro === "pendente") l = l.filter((t) => t.status === "pendente");
    if (catFiltro) l = l.filter((t) => t.categoriaId === catFiltro);
    return filtrarBusca(l, busca, (id) => catPorId.get(id)?.nome || "");
  }, [doMes, filtro, catFiltro, busca, catPorId]);
  const dias = useMemo(() => agruparPorDia(lista), [lista]);
  const [agrupar, setAgrupar] = usePreferencia("financas_app_agrupar_lanc", "dia"); // dia | categoria
  const porCategoria = useMemo(() => agruparPorCategoria(lista), [lista]);
  const volumeTotal = porCategoria.reduce((s, g) => s + g.volume, 0);
  const [abertas, setAbertas] = useState(() => new Set());
  const alternarCat = (id) =>
    setAbertas((a) => {
      const n = new Set(a);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const FILTROS = [
    ["tudo", "Tudo"],
    ["despesa", "Despesas"],
    ["receita", rotReceita],
    ["pendente", `Pendentes${pendentes.length ? ` (${pendentes.length})` : ""}`],
  ];
  const chip = "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ";
  const chipOff = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
  const chipOn = "border-slate-800 bg-slate-800 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900";
  const filtrando = filtro !== "tudo" || catFiltro || busca.trim();

  function excluir(t) {
    setSelecionado(null);
    if (t.recorrencia) setExcluindoSerie(t);
    else acoes.excluir(t.id);
  }

  return (
    <div className="space-y-4">
      {/* Resumo do mês */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Entrou</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtBRL(entrou)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Saiu</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmtBRL(saiu)}</p>
        </div>
      </div>

      {/* Ações no computador (no celular o botão + fica na barra de baixo) */}
      <div className="hidden gap-2 md:flex">
        <button
          onClick={() => abrirLancamento({ tipo: "despesa" })}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900"
        >
          <Plus size={16} /> Nova despesa
        </button>
        <button
          onClick={() => abrirLancamento({ tipo: "receita" })}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus size={16} /> {empresarial ? "Nova entrada" : "Nova receita"}
        </button>
      </div>

      {/* Busca + filtros */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição, categoria ou valor"
            aria-label="Buscar lançamentos"
            enterKeyHint="search"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-900/40"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map(([v, r]) => (
            <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)} className={chip + (filtro === v ? chipOn : chipOff)}>
              {r}
            </button>
          ))}
          <button type="button" onClick={() => setEscolhendoCat(true)} className={chip + (catFiltro ? chipOn : chipOff)}>
            {catFiltro ? catNome(catFiltro) : "Categoria"} <ChevronDown size={15} />
          </button>
        </div>
      </div>

      {dias.length > 0 && (
        <SeletorAgrupamento
          valor={agrupar}
          onMudar={setAgrupar}
          opcoes={[
            ["dia", "Por dia"],
            ["categoria", "Por categoria"],
          ]}
        />
      )}

      {/* Lista por dia ou por categoria */}
      {dias.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
            {filtrando ? "Nada encontrado com esses filtros" : `Nenhum lançamento em ${MESES[mesIdx]}`}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {filtrando ? "Tente outra busca ou limpe os filtros." : "Toque em + para lançar uma despesa ou receita."}
          </p>
          {filtrando ? (
            <button
              onClick={() => {
                setFiltro("tudo");
                setCatFiltro(null);
                setBusca("");
              }}
              className="mt-4 h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Limpar filtros
            </button>
          ) : (
            <button onClick={() => abrirLancamento({ tipo: "despesa" })} className="mt-4 h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white">
              Lançar agora
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {agrupar === "categoria" && (
            <div className="space-y-3">
              {porCategoria.map((g) => (
                <GrupoCategoria
                  key={g.categoriaId || "sem"}
                  cat={catPorId.get(g.categoriaId)}
                  quantidade={g.itens.length}
                  total={g.total}
                  participacao={volumeTotal ? g.volume / volumeTotal : 0}
                  aberto={abertas.has(g.categoriaId)}
                  onAlternar={() => alternarCat(g.categoriaId)}
                >
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {g.itens.map((t) => (
                      <li key={t.id}>
                        <LinhaLancamento t={t} cat={catPorId.get(t.categoriaId)} subtitulo={rotuloDia(t.data, hoje)} onAbrir={() => setSelecionado(t)} />
                      </li>
                    ))}
                  </ul>
                </GrupoCategoria>
              ))}
            </div>
          )}
          {agrupar !== "categoria" && dias.map(({ data, itens, total }) => (
            <section key={data} aria-label={rotuloDia(data, hoje)}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{rotuloDia(data, hoje)}</h3>
                <span className={"text-xs font-semibold tabular-nums " + (total >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400")}>
                  {total > 0 ? "+" : total < 0 ? "−" : ""}
                  {fmtBRL(Math.abs(total))}
                </span>
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {itens.map((t) => (
                  <li key={t.id}>
                    <LinhaLancamento t={t} cat={catPorId.get(t.categoriaId)} onAbrir={() => setSelecionado(t)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="pb-2 text-center text-xs text-slate-500 dark:text-slate-400">
            {lista.length} lançamento{lista.length !== 1 ? "s" : ""} em {MESES[mesIdx]} de {ano}
          </p>
        </div>
      )}

      {/* Escolher categoria para filtrar */}
      {escolhendoCat && (
        <Sheet titulo="Filtrar por categoria" onFechar={() => setEscolhendoCat(false)}>
          <div className="flex flex-col gap-1">
            <OpcaoLista
              ativo={!catFiltro}
              onClick={() => {
                setCatFiltro(null);
                setEscolhendoCat(false);
              }}
            >
              Todas as categorias
            </OpcaoLista>
            {espaco.categorias.map((c) => (
              <OpcaoLista
                key={c.id}
                ativo={catFiltro === c.id}
                cor={cssGrad(gradCat(c))}
                onClick={() => {
                  setCatFiltro(c.id);
                  setEscolhendoCat(false);
                }}
              >
                {c.nome}
              </OpcaoLista>
            ))}
          </div>
        </Sheet>
      )}

      {/* Ações de um lançamento */}
      {selecionado && (
        <AcoesLancamento
          t={selecionado}
          cat={catPorId.get(selecionado.categoriaId)}
          onFechar={() => setSelecionado(null)}
          onEditar={() => {
            setSelecionado(null);
            abrirLancamento({ inicial: selecionado });
          }}
          onDuplicar={() => {
            const { id: _id, recorrencia: _r, comprovante: _c, ...resto } = selecionado;
            setSelecionado(null);
            abrirLancamento({ inicial: { ...resto, data: hoje } });
          }}
          onAlternarStatus={() => {
            setSelecionado(null);
            if (selecionado.status === "ok") acoes.marcarPendente(selecionado.id);
            else acoes.marcarOk(selecionado.id);
          }}
          onComprovante={() => {
            setVerComprovante(selecionado.comprovante);
            setSelecionado(null);
          }}
          onExcluir={() => excluir(selecionado)}
        />
      )}

      {excluindoSerie && (
        <ModalExcluirConta
          transacao={excluindoSerie}
          onExcluir={acoes.excluir}
          onExcluirSerie={acoes.excluirSerie}
          onFechar={() => setExcluindoSerie(null)}
        />
      )}

      {verComprovante && (
        <Sheet titulo="Comprovante" onFechar={() => setVerComprovante(null)}>
          <img src={verComprovante} alt="Comprovante" className="w-full rounded-xl" />
        </Sheet>
      )}
    </div>
  );
}

// Linha da lista: área de toque inteira, descrição usando a largura toda.
export function LinhaLancamento({ t, cat, onAbrir, direita, subtitulo }) {
  const nome = t.descricao || cat?.nome || "Lançamento";
  const ehReceita = t.tipo === "receita";
  const pendente = t.status === "pendente";
  const grad = cat ? gradCat(cat) : gradPorId("grafite");
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={onAbrir}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60 dark:active:bg-slate-800"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ background: cssGrad(grad) }}
          aria-hidden
        >
          {(nome.trim()[0] || "?").toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">{nome}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">{subtitulo || cat?.nome || "Sem categoria"}</span>
            {pendente && (
              <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {ehReceita ? "a receber" : "a pagar"}
              </span>
            )}
            {t.recorrencia && <Repeat size={12} className="shrink-0" aria-label={rotuloRecorrencia(t.recorrencia)} />}
            {t.comprovante && <Paperclip size={12} className="shrink-0" aria-label="Tem comprovante" />}
          </span>
        </span>
        <span
          className={
            "shrink-0 text-right text-[15px] font-bold tabular-nums " +
            (pendente ? "text-slate-400 dark:text-slate-500" : ehReceita ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")
          }
        >
          {ehReceita ? "+" : "−"}
          {fmtBRL(t.valor)}
        </span>
      </button>
      {direita}
    </div>
  );
}

function OpcaoLista({ ativo, cor, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={
        "flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-base font-medium transition " +
        (ativo ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800")
      }
    >
      {cor && <span className="h-3 w-3 rounded-full" style={{ background: cor }} aria-hidden />}
      <span className="flex-1">{children}</span>
      {ativo && <Check size={18} />}
    </button>
  );
}

// Painel de ações de um lançamento (abre ao tocar na linha)
export function AcoesLancamento({ t, cat, onFechar, onEditar, onDuplicar, onAlternarStatus, onComprovante, onExcluir }) {
  const ehReceita = t.tipo === "receita";
  const nome = t.descricao || cat?.nome || "Lançamento";
  const item =
    "flex min-h-13 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800";
  return (
    <Sheet titulo={nome} onFechar={onFechar}>
      <div className="mb-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
        <p className={"text-2xl font-bold tabular-nums " + (ehReceita ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100")}>
          {ehReceita ? "+" : "−"}
          {fmtBRL(t.valor)}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {cat?.nome || "Sem categoria"} · {fmtData(t.data)} ·{" "}
          {t.status === "ok" ? (ehReceita ? "Recebido" : "Pago") : ehReceita ? "A receber" : "A pagar"}
        </p>
        {t.recorrencia && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <Repeat size={14} /> {rotuloRecorrencia(t.recorrencia)}
          </p>
        )}
      </div>
      <div className="flex flex-col">
        <button type="button" onClick={onEditar} className={item + " text-slate-700 dark:text-slate-200"}>
          <Pencil size={19} className="text-slate-500" /> Editar
        </button>
        <button type="button" onClick={onDuplicar} className={item + " text-slate-700 dark:text-slate-200"}>
          <Copy size={19} className="text-slate-500" /> Duplicar para hoje
        </button>
        <button type="button" onClick={onAlternarStatus} className={item + " text-slate-700 dark:text-slate-200"}>
          {t.status === "ok" ? <Clock size={19} className="text-amber-600" /> : <Check size={19} className="text-emerald-600" />}
          {t.status === "ok" ? (ehReceita ? "Voltar para a receber" : "Voltar para a pagar") : ehReceita ? "Marcar como recebido" : "Marcar como pago"}
        </button>
        {t.comprovante && (
          <button type="button" onClick={onComprovante} className={item + " text-slate-700 dark:text-slate-200"}>
            <ImageIcon size={19} className="text-slate-500" /> Ver comprovante
          </button>
        )}
        <button type="button" onClick={onExcluir} className={item + " text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"}>
          <Trash2 size={19} /> Excluir
        </button>
      </div>
    </Sheet>
  );
}
