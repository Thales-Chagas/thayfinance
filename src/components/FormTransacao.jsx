import React, { useState, useMemo, useRef, useEffect } from "react";
import { Check, Plus, Repeat, CalendarDays, ChevronDown, Image as ImageIcon, Loader2 } from "lucide-react";
import { uid, hojeISO, somaDias, fmtData, fmtBRL, fmtNum, parseDinheiro } from "../lib/formato";
import { RECORRENCIAS, dataRecorrencia, rotuloRecorrencia } from "../lib/recorrencia";
import { gradPorId, gradientePorNome, gradCat, cssGrad } from "../lib/cores";
import { categoriasPorUso, sugestoesDescricao, normalizar } from "../lib/transacoes";
import { SeletorGradiente, inputCls, Campo } from "./ui";
import { Sheet } from "./Sheet";
import { CapturaIA } from "./CapturaIA";

/* ============================================================
   LANÇAMENTO (novo, editar, duplicar)
   Pensado para o celular: o valor vem primeiro e já com o teclado
   numérico; categorias em botões (as mais usadas primeiro); a descrição
   sugere lançamentos anteriores e já traz a categoria. Repetição,
   cliente, fornecedor e centro de custo ficam em "Mais opções".
   O id é criado ao abrir: dois toques em Salvar gravam o MESMO registro.
   ============================================================ */

const ENTRADAS = ["Faturamento", "Salário"];
const CHIPS_VISIVEIS = 8;

export function FormTransacao({
  tipo,
  inicial,
  espaco,
  empresarial,
  statusPadrao = "ok",
  onSalvar,
  onCriarCategoria,
  onFechar,
  showToast,
}) {
  const editando = !!inicial?.id;
  const hoje = hojeISO();
  const ontem = somaDias(hoje, -1);

  const catPadrao = (tp) =>
    tp === "receita"
      ? espaco.categorias.find((c) => ENTRADAS.includes(c.nome)) || espaco.categorias[0]
      : espaco.categorias.find((c) => !ENTRADAS.includes(c.nome)) || espaco.categorias[0];

  const [t, setT] = useState(() =>
    inicial
      ? { ...inicial, id: inicial.id || uid() }
      : {
          id: uid(),
          tipo,
          data: hoje,
          categoriaId: catPadrao(tipo)?.id || "",
          valor: 0,
          descricao: "",
          status: statusPadrao,
          clienteId: "",
          fornecedorId: "",
          centroCustoId: "",
        }
  );
  // valor como texto enquanto digita (vira número só ao salvar)
  const [valorTxt, setValorTxt] = useState(() => (inicial?.valor ? fmtNum(inicial.valor) : ""));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [todasCats, setTodasCats] = useState(false);
  const [focoDescricao, setFocoDescricao] = useState(false);
  const ehReceita = t.tipo === "receita";
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }));
  const valorRef = useRef(null);

  // Foco no valor ao abrir um lançamento novo (o teclado numérico já sobe)
  useEffect(() => {
    if (!editando) valorRef.current?.focus({ preventScroll: true });
  }, [editando]);

  function trocarTipo(novo) {
    if (novo === t.tipo) return;
    setT((p) => {
      const cat = espaco.categorias.find((c) => c.id === p.categoriaId);
      // troca a categoria padrão se a atual for "de entrada" numa despesa (ou vice-versa)
      const precisaTrocar = !cat || (novo === "receita") !== ENTRADAS.includes(cat.nome);
      return { ...p, tipo: novo, categoriaId: precisaTrocar ? catPadrao(novo)?.id || p.categoriaId : p.categoriaId };
    });
  }

  // ---- Categorias: mais usadas primeiro ----
  const catsOrdenadas = useMemo(
    () => categoriasPorUso(espaco.transacoes, espaco.categorias, t.tipo, hoje),
    [espaco.transacoes, espaco.categorias, t.tipo, hoje]
  );
  const catsVisiveis = useMemo(() => {
    if (todasCats || catsOrdenadas.length <= CHIPS_VISIVEIS + 1) return catsOrdenadas;
    const topo = catsOrdenadas.slice(0, CHIPS_VISIVEIS);
    const sel = catsOrdenadas.find((c) => c.id === t.categoriaId);
    return sel && !topo.includes(sel) ? [...topo.slice(0, -1), sel] : topo;
  }, [catsOrdenadas, todasCats, t.categoriaId]);

  // ---- Sugestões pela descrição ----
  const sugestoes = useMemo(
    () => (editando ? [] : sugestoesDescricao(espaco.transacoes, t.tipo, t.descricao)),
    [espaco.transacoes, t.tipo, t.descricao, editando]
  );
  function usarSugestao(s) {
    setT((p) => ({
      ...p,
      descricao: s.descricao,
      categoriaId: espaco.categorias.some((c) => c.id === s.categoriaId) ? s.categoriaId : p.categoriaId,
    }));
    if (!parseDinheiro(valorTxt) && s.valor) setValorTxt(fmtNum(s.valor));
    setFocoDescricao(false);
  }

  // ---- Recorrência ----
  const recInicial = inicial?.recorrencia || null;
  const [recAtiva, setRecAtiva] = useState(!!recInicial);
  const [recTipo, setRecTipo] = useState(recInicial?.tipo || "mensal");
  const [recCada, setRecCada] = useState(recInicial?.cada || 30);
  const [recFim, setRecFim] = useState(recInicial?.fim || "");
  const regraForm = recAtiva
    ? { tipo: recTipo, cada: recTipo === "dias" ? Math.max(1, Number(recCada) || 0) : null, fim: recFim || null }
    : null;
  const regraOriginal = recInicial
    ? { tipo: recInicial.tipo, cada: recInicial.cada ?? null, fim: recInicial.fim ?? null }
    : null;
  const recMudou = JSON.stringify(regraForm) !== JSON.stringify(regraOriginal);

  const previa = useMemo(() => {
    if (!recAtiva || !t.data) return null;
    const regra = { ...regraForm, inicio: t.data, grupo: "previa" };
    if (!dataRecorrencia(regra, 0)) return null;
    const datas = [];
    let total = 0;
    for (let n = 0; n < 500; n++) {
      const d = dataRecorrencia(regra, n);
      if (regra.fim && d > regra.fim) break;
      total++;
      if (datas.length < 4) datas.push(d);
      if (!regra.fim && total > 4) break;
    }
    return { datas, total: regra.fim ? total : null, estourou: !!regra.fim && total >= 500 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recAtiva, recTipo, recCada, recFim, t.data]);

  const temExtrasEmpresa =
    empresarial &&
    ((ehReceita && espaco.clientes.length > 0) || (!ehReceita && (espaco.fornecedores.length > 0 || espaco.centrosCusto.length > 0)));
  const [maisOpcoes, setMaisOpcoes] = useState(
    () => !!recInicial || !!inicial?.clienteId || !!inicial?.fornecedorId || !!inicial?.centroCustoId
  );

  // ---- Nova categoria sem sair do lançamento ----
  const [criandoCat, setCriandoCat] = useState(false);
  const [novaCat, setNovaCat] = useState("");
  const [novaCor, setNovaCor] = useState(null);
  const sugestaoCor = gradientePorNome(novaCat);
  function confirmarNovaCat() {
    const nome = novaCat.trim();
    if (nome) {
      const cat = onCriarCategoria?.(nome, novaCor || sugestaoCor.id);
      if (cat?.id) set("categoriaId", cat.id);
    }
    setNovaCat("");
    setNovaCor(null);
    setCriandoCat(false);
  }

  // ---- Resultado da IA (foto do comprovante ou áudio) preenche o formulário ----
  function aplicarIA(ai) {
    const tp = ai.tipo === "receita" ? "receita" : "despesa";
    const alvo = normalizar(ai.categoria);
    const cat =
      espaco.categorias.find((c) => normalizar(c.nome) === alvo) ||
      (alvo && espaco.categorias.find((c) => normalizar(c.nome).includes(alvo) || alvo.includes(normalizar(c.nome)))) ||
      catPadrao(tp);
    setT((p) => ({
      ...p,
      tipo: tp,
      data: ai.data || p.data,
      categoriaId: cat?.id || p.categoriaId,
      descricao: ai.descricao || ai.estabelecimento || p.descricao,
      comprovante: ai.comprovante || p.comprovante || null,
    }));
    if (Number(ai.valor) > 0) setValorTxt(fmtNum(Number(ai.valor)));
    showToast?.("Preenchi pelo que li. Confira e salve.");
  }

  function salvar(e) {
    e?.preventDefault();
    if (salvando) return;
    const valor = parseDinheiro(valorTxt);
    if (valor === null) return mostrarErro("Não entendi o valor. Use só números, ex.: 86,40");
    if (!valor || valor <= 0) return mostrarErro("Digite um valor maior que zero.", valorRef);
    if (!t.data) return mostrarErro("Escolha a data.");
    if (!t.categoriaId) return mostrarErro("Escolha uma categoria.");
    if (recAtiva && recTipo === "dias" && (!Number(recCada) || Number(recCada) < 1))
      return mostrarErro("Na repetição personalizada, diga a cada quantos dias.");
    if (recAtiva && recFim && recFim < t.data)
      return mostrarErro("A data final da repetição precisa ser depois do primeiro vencimento.");
    setSalvando(true);
    const final = { ...t, valor, descricao: t.descricao.trim() };
    // Numa edição sem mexer na repetição, `undefined` preserva a série como está.
    onSalvar(final, editando && !recMudou ? undefined : regraForm, { novo: !editando });
    onFechar();
  }
  function mostrarErro(msg, campo) {
    setErro(msg);
    campo?.current?.focus();
  }

  const titulo = (editando ? "Editar " : "Nova ") + (ehReceita ? (empresarial ? "entrada" : "receita") : "despesa");
  const corTipo = ehReceita ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100";
  const dataEhOutra = t.data !== hoje && t.data !== ontem;

  const chip =
    "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition active:scale-[0.97] ";
  const chipOff =
    "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700";
  const chipOn = "border-emerald-600 bg-emerald-600 text-white";

  return (
    <Sheet
      titulo={titulo}
      onFechar={onFechar}
      rodape={
        <div className="space-y-2">
          {erro && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {erro}
            </p>
          )}
          <button
            type="submit"
            form="form-lancamento"
            disabled={salvando}
            className={
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60 " +
              (ehReceita ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-800 hover:bg-slate-900 dark:bg-emerald-600 dark:hover:bg-emerald-700")
            }
          >
            {salvando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {editando ? "Salvar alterações" : `Salvar ${ehReceita ? (empresarial ? "entrada" : "receita") : "despesa"}`}
          </button>
        </div>
      }
    >
      <form id="form-lancamento" onSubmit={salvar} className="space-y-5" noValidate>
        {/* Tipo + leitura por IA */}
        {!editando && (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Tipo de lançamento">
              {[
                ["despesa", "Despesa"],
                ["receita", empresarial ? "Entrada" : "Receita"],
              ].map(([v, r]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={t.tipo === v}
                  onClick={() => trocarTipo(v)}
                  className={
                    "h-10 flex-1 rounded-lg text-sm font-semibold transition " +
                    (t.tipo === v
                      ? v === "receita"
                        ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                        : "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                      : "text-slate-500 dark:text-slate-400")
                  }
                >
                  {r}
                </button>
              ))}
            </div>
            <CapturaIA onResultado={aplicarIA} showToast={showToast} compacto />
          </div>
        )}

        {/* Valor */}
        <div className="text-center">
          <label htmlFor="valor-lancamento" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Valor
          </label>
          <div className="mt-1 flex items-baseline justify-center gap-1.5">
            <span className="text-xl font-semibold text-slate-400 dark:text-slate-500">R$</span>
            <input
              ref={valorRef}
              id="valor-lancamento"
              type="text"
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              placeholder="0,00"
              value={valorTxt}
              onChange={(e) => {
                const v = e.target.value;
                if (/^[\d.,\s]*$/.test(v)) setValorTxt(v);
                if (erro) setErro("");
              }}
              onBlur={() => {
                const n = parseDinheiro(valorTxt);
                if (n) setValorTxt(fmtNum(n));
              }}
              className={
                "campo-grande min-w-0 max-w-[15rem] bg-transparent text-left text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 " +
                corTipo
              }
              style={{ width: `${Math.max(4, (valorTxt || "0,00").length) + 0.6}ch` }}
            />
          </div>
          <div className="mx-auto mt-1 h-0.5 max-w-[12rem] rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Categoria */}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Categoria</legend>
          {criandoCat ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex gap-2">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
                  style={{ background: cssGrad(gradPorId(novaCor) || sugestaoCor) }}
                  aria-hidden
                >
                  {(novaCat.trim()[0] || "?").toUpperCase()}
                </div>
                <input
                  type="text"
                  value={novaCat}
                  onChange={(e) => setNovaCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmarNovaCat();
                    }
                  }}
                  placeholder="Nome da nova categoria"
                  aria-label="Nome da nova categoria"
                  enterKeyHint="done"
                  className={inputCls + " h-11 flex-1"}
                  autoFocus
                />
              </div>
              <SeletorGradiente valor={novaCor} sugestao={sugestaoCor} onChange={setNovaCor} />
              <div className="flex gap-2">
                <button type="button" onClick={confirmarNovaCat} className="h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">
                  Criar categoria
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNovaCat("");
                    setNovaCor(null);
                    setCriandoCat(false);
                  }}
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoria">
              {catsVisiveis.map((c) => {
                const ativo = t.categoriaId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => {
                      set("categoriaId", c.id);
                      if (erro) setErro("");
                    }}
                    className={chip + (ativo ? "border-transparent text-white" : chipOff)}
                    style={ativo ? { background: cssGrad(gradCat(c)) } : undefined}
                  >
                    {!ativo && <span className="h-2.5 w-2.5 rounded-full" style={{ background: cssGrad(gradCat(c)) }} aria-hidden />}
                    {c.nome}
                  </button>
                );
              })}
              {catsOrdenadas.length > catsVisiveis.length && (
                <button type="button" onClick={() => setTodasCats(true)} className={chip + chipOff}>
                  Todas ({catsOrdenadas.length}) <ChevronDown size={15} />
                </button>
              )}
              {onCriarCategoria && (
                <button
                  type="button"
                  onClick={() => setCriandoCat(true)}
                  className={chip + "border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"}
                >
                  <Plus size={15} /> Nova
                </button>
              )}
              {espaco.categorias.length === 0 && !onCriarCategoria && (
                <p className="text-sm text-slate-500">Crie categorias na página Categorias.</p>
              )}
            </div>
          )}
        </fieldset>

        {/* Descrição + sugestões */}
        <div>
          <label htmlFor="descricao-lancamento" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Descrição <span className="font-normal normal-case tracking-normal">(opcional)</span>
          </label>
          <input
            id="descricao-lancamento"
            type="text"
            value={t.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            onFocus={() => setFocoDescricao(true)}
            onBlur={() => setTimeout(() => setFocoDescricao(false), 150)}
            placeholder={ehReceita ? "Ex.: sessão, venda, salário…" : "Ex.: mercado, aluguel, uber…"}
            autoComplete="off"
            enterKeyHint="done"
            className={inputCls + " h-12"}
          />
          {sugestoes.length > 0 && (focoDescricao || t.descricao) && (
            <div className="mt-2 flex flex-col gap-1.5">
              {sugestoes.map((s) => {
                const cat = espaco.categorias.find((c) => c.id === s.categoriaId);
                return (
                  <button
                    key={s.descricao}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => usarSugestao(s)}
                    className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm transition hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cssGrad(gradCat(cat)) }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      <b className="font-semibold text-slate-800 dark:text-slate-100">{s.descricao}</b>
                      <span className="text-slate-500 dark:text-slate-400"> · {cat?.nome || "sem categoria"}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{fmtBRL(s.valor)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Data + situação */}
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" id="rotulo-data">
              {t.status === "pendente" ? "Vencimento" : "Data"}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rotulo-data">
              <button type="button" onClick={() => set("data", hoje)} className={chip + (t.data === hoje ? chipOn : chipOff)}>
                Hoje
              </button>
              <button type="button" onClick={() => set("data", ontem)} className={chip + (t.data === ontem ? chipOn : chipOff)}>
                Ontem
              </button>
              <label className={chip + "relative cursor-pointer " + (dataEhOutra ? chipOn : chipOff)}>
                <CalendarDays size={15} aria-hidden />
                {dataEhOutra ? fmtData(t.data) : "Outra data"}
                <input
                  type="date"
                  value={t.data}
                  onChange={(e) => e.target.value && set("data", e.target.value)}
                  aria-label="Escolher outra data"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Situação">
            {[
              ["ok", ehReceita ? "Recebido" : "Pago"],
              ["pendente", ehReceita ? "A receber" : "A pagar"],
            ].map(([v, r]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={t.status === v}
                onClick={() => set("status", v)}
                className={
                  "h-10 flex-1 rounded-lg text-sm font-semibold transition " +
                  (t.status === v
                    ? v === "ok"
                      ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                      : "bg-white text-amber-700 shadow-sm dark:bg-slate-700 dark:text-amber-300"
                    : "text-slate-500 dark:text-slate-400")
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Mais opções */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setMaisOpcoes((v) => !v)}
            aria-expanded={maisOpcoes}
            className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            <span className="flex-1">
              Mais opções
              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                {recAtiva
                  ? `Repete: ${rotuloRecorrencia({ tipo: recTipo, cada: recCada })}${recFim ? " até " + fmtData(recFim) : ""}`
                  : empresarial
                  ? "Repetir, cliente, fornecedor, centro de custo"
                  : "Repetir todo mês, comprovante"}
              </span>
            </span>
            <ChevronDown size={18} className={"shrink-0 text-slate-400 transition " + (maisOpcoes ? "rotate-180" : "")} />
          </button>

          {maisOpcoes && (
            <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-700">
              {/* Repetir */}
              <div>
                <button type="button" onClick={() => setRecAtiva((v) => !v)} className="flex w-full items-center gap-3 text-left" aria-pressed={recAtiva}>
                  <span
                    className={
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white " +
                      (recAtiva ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700")
                    }
                  >
                    <Repeat size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Repetir lançamento</span>
                    <span className="block text-xs leading-snug text-slate-500 dark:text-slate-400">
                      Aluguel, mensalidade, assinatura… os próximos ficam programados.
                    </span>
                  </span>
                  <span aria-hidden className={"relative h-7 w-12 shrink-0 rounded-full transition " + (recAtiva ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}>
                    <span className={"absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all " + (recAtiva ? "left-[22px]" : "left-0.5")} />
                  </span>
                </button>

                {recAtiva && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(RECORRENCIAS).map(([id, def]) => (
                        <button key={id} type="button" onClick={() => setRecTipo(id)} className={chip + "h-10 " + (recTipo === id ? chipOn : chipOff)}>
                          {def.rotulo}
                        </button>
                      ))}
                    </div>
                    {recTipo === "dias" && (
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        Repetir a cada
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="999"
                          value={recCada}
                          onChange={(e) => setRecCada(e.target.value)}
                          className={inputCls + " h-11 !w-20 text-center"}
                        />
                        dias
                      </label>
                    )}
                    <Campo label="Repetir até">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setRecFim("")} className={chip + "shrink-0 " + (!recFim ? chipOn : chipOff)}>
                          Sem término
                        </button>
                        <input
                          type="date"
                          value={recFim}
                          min={t.data || undefined}
                          onChange={(e) => setRecFim(e.target.value)}
                          aria-label="Data final da repetição"
                          className={inputCls + " h-11 flex-1"}
                        />
                      </div>
                    </Campo>
                    {previa && (
                      <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
                        <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                          <CalendarDays size={13} /> Próximos vencimentos
                        </p>
                        <p className="text-sm tabular-nums text-emerald-800 dark:text-emerald-200">
                          {previa.datas.map(fmtData).join(" · ")}
                          {(previa.total === null || previa.total > previa.datas.length) && " …"}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/70">
                          {previa.total !== null
                            ? `${previa.estourou ? "Mais de " : ""}${previa.total} lançamento${previa.total > 1 ? "s" : ""} até ${fmtData(recFim)}.`
                            : "Sem data final — deixo sempre os próximos 12 meses programados."}
                        </p>
                      </div>
                    )}
                    {editando && recInicial && recMudou && (
                      <p className="text-xs leading-snug text-amber-700 dark:text-amber-400">
                        A mudança vale deste lançamento em diante — os anteriores ficam como estão.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {temExtrasEmpresa && ehReceita && (
                <Campo label="Cliente (opcional)">
                  <select value={t.clienteId || ""} onChange={(e) => set("clienteId", e.target.value)} className={inputCls + " h-11"}>
                    <option value="">—</option>
                    {espaco.clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
              {temExtrasEmpresa && !ehReceita && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {espaco.fornecedores.length > 0 && (
                    <Campo label="Fornecedor (opcional)">
                      <select value={t.fornecedorId || ""} onChange={(e) => set("fornecedorId", e.target.value)} className={inputCls + " h-11"}>
                        <option value="">—</option>
                        {espaco.fornecedores.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                  {espaco.centrosCusto.length > 0 && (
                    <Campo label="Centro de custo (opcional)">
                      <select value={t.centroCustoId || ""} onChange={(e) => set("centroCustoId", e.target.value)} className={inputCls + " h-11"}>
                        <option value="">—</option>
                        {espaco.centrosCusto.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                </div>
              )}

              {t.comprovante && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <ImageIcon size={13} /> Comprovante
                  </p>
                  <img src={t.comprovante} alt="Comprovante anexado" className="max-h-48 rounded-xl border border-slate-200 dark:border-slate-700" />
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
}
