import React, { useState, useMemo } from "react";
import { Check, Plus, Repeat, CalendarDays } from "lucide-react";
import { hojeISO, fmtData } from "../lib/formato";
import { RECORRENCIAS, dataRecorrencia, rotuloRecorrencia } from "../lib/recorrencia";
import { gradPorId, gradientePorNome, cssGrad } from "../lib/cores";
import { SeletorGradiente, BotaoPrimario, CurrencyField, inputCls, Campo, Modal } from "./ui";

/* ============================================================
   FORMULÁRIOS
   ============================================================ */

export function FormTransacao({ tipo, inicial, espaco, empresarial, statusPadrao = "ok", onSalvar, onCriarCategoria, onFechar }) {
  const ENTRADAS = ["Faturamento", "Salário"];
  const catPadrao =
    tipo === "receita"
      ? espaco.categorias.find((c) => ENTRADAS.includes(c.nome)) || espaco.categorias[0]
      : espaco.categorias.find((c) => !ENTRADAS.includes(c.nome)) || espaco.categorias[0];
  const [t, setT] = useState(
    inicial || {
      tipo,
      data: hojeISO(),
      categoriaId: catPadrao?.id || "",
      valor: 0,
      descricao: "",
      status: statusPadrao,
      clienteId: "",
      fornecedorId: "",
      centroCustoId: "",
    }
  );
  const [erro, setErro] = useState("");
  const ehReceita = (inicial ? inicial.tipo : tipo) === "receita";
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }));

  // ---- Recorrência: estado da seção "Repetir lançamento" ----
  const recInicial = inicial?.recorrencia || null;
  const [recAtiva, setRecAtiva] = useState(!!recInicial);
  const [recTipo, setRecTipo] = useState(recInicial?.tipo || "mensal");
  const [recCada, setRecCada] = useState(recInicial?.cada || 30); // p/ "a cada X dias"
  const [recFim, setRecFim] = useState(recInicial?.fim || "");    // "" = sem término
  // regra que sai do formulário (null = repetição desligada)
  const regraForm = recAtiva
    ? { tipo: recTipo, cada: recTipo === "dias" ? Math.max(1, Number(recCada) || 0) : null, fim: recFim || null }
    : null;
  const regraOriginal = recInicial
    ? { tipo: recInicial.tipo, cada: recInicial.cada ?? null, fim: recInicial.fim ?? null }
    : null;
  const recMudou = JSON.stringify(regraForm) !== JSON.stringify(regraOriginal);

  // prévia dos próximos vencimentos (a partir da data escolhida)
  const previa = useMemo(() => {
    if (!recAtiva || !t.data) return null;
    const regra = { ...regraForm, inicio: t.data, grupo: "previa" };
    if (!dataRecorrencia(regra, 0)) return null; // regra incompleta (ex.: X dias vazio)
    const datas = [];
    let total = 0;
    for (let n = 0; n < 500; n++) {
      const d = dataRecorrencia(regra, n);
      if (regra.fim && d > regra.fim) break;
      total++;
      if (datas.length < 4) datas.push(d);
      if (!regra.fim && total > 4) break; // sem término: só as primeiras interessam
    }
    return { datas, total: regra.fim ? total : null, estourou: !!regra.fim && total >= 500 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recAtiva, recTipo, recCada, recFim, t.data]);

  // Criação de categoria na hora, sem sair do lançamento.
  const [criandoCat, setCriandoCat] = useState(false);
  const [novaCat, setNovaCat] = useState("");
  const [novaCor, setNovaCor] = useState(null); // null = automática (sugerida pelo nome)
  const sugestaoCat = gradientePorNome(novaCat); // acompanha o que a pessoa digita
  function confirmarNovaCat() {
    const nome = novaCat.trim();
    if (!nome) {
      setCriandoCat(false);
      return;
    }
    // guarda a cor resolvida (escolhida ou sugerida) pra ficar estável
    const cat = onCriarCategoria?.(nome, novaCor || sugestaoCat.id); // salva no login+tipo atuais
    if (cat?.id) set("categoriaId", cat.id); // já seleciona a nova
    setNovaCat("");
    setNovaCor(null);
    setCriandoCat(false);
  }

  function salvar(e) {
    e.preventDefault();
    if (!t.data) return setErro("Escolha a data.");
    if (!t.valor || t.valor <= 0) return setErro("Digite um valor maior que zero.");
    if (!t.categoriaId) return setErro("Escolha uma categoria.");
    if (recAtiva && recTipo === "dias" && (!Number(recCada) || Number(recCada) < 1))
      return setErro("Na repetição personalizada, diga a cada quantos dias.");
    if (recAtiva && recFim && recFim < t.data)
      return setErro("A data final da repetição precisa ser depois do primeiro vencimento.");
    // Numa edição sem mexer na repetição, `undefined` preserva a série como está.
    onSalvar(t, inicial?.id && !recMudou ? undefined : regraForm);
    onFechar();
  }

  return (
    <Modal
      titulo={(inicial?.id ? "Editar " : "Nova ") + (ehReceita ? "receita" : "despesa")}
      onFechar={onFechar}
    >
      <form onSubmit={salvar} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data">
            <input
              type="date"
              value={t.data}
              onChange={(e) => set("data", e.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo label="Valor (R$)">
            <CurrencyField value={t.valor} onChange={(v) => set("valor", v)} className="!w-full" />
          </Campo>
        </div>
        <Campo label="Categoria">
          {criandoCat ? (
            <div className="space-y-2.5 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex gap-2">
                {/* pré-visualização ao vivo: a bolinha muda junto com o nome/cor */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                  style={{ background: cssGrad(gradPorId(novaCor) || sugestaoCat) }}
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
                    } else if (e.key === "Escape") {
                      setNovaCat("");
                      setNovaCor(null);
                      setCriandoCat(false);
                    }
                  }}
                  placeholder="Nome da nova categoria"
                  className={inputCls + " flex-1"}
                  autoFocus
                />
              </div>
              <SeletorGradiente valor={novaCor} sugestao={sugestaoCat} onChange={setNovaCor} />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {novaCor
                  ? `Cor escolhida: ${gradPorId(novaCor)?.nome}`
                  : `Cor automática pela categoria: ${sugestaoCat.nome} — toque numa bolinha pra trocar`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmarNovaCat}
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Salvar categoria
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNovaCat("");
                    setNovaCor(null);
                    setCriandoCat(false);
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={t.categoriaId}
                onChange={(e) => set("categoriaId", e.target.value)}
                className={inputCls + " flex-1"}
              >
                {espaco.categorias.length === 0 && <option value="">— nenhuma ainda —</option>}
                {espaco.categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              {onCriarCategoria && (
                <button
                  type="button"
                  onClick={() => setCriandoCat(true)}
                  className="flex items-center gap-1 rounded-xl border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                  aria-label="Criar nova categoria"
                >
                  <Plus size={16} /> Nova
                </button>
              )}
            </div>
          )}
        </Campo>
        <Campo label="Descrição">
          <input
            type="text"
            value={t.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder={ehReceita ? "Ex.: venda, sessão, salário..." : "Ex.: aluguel, mercado..."}
            className={inputCls}
          />
        </Campo>
        <Campo label="Status">
          <select value={t.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
            <option value="ok">{ehReceita ? "Recebido" : "Pago"}</option>
            <option value="pendente">Pendente</option>
          </select>
        </Campo>

        {/* ---- Recorrência: repete o lançamento e programa os próximos ---- */}
        <div
          className={
            "rounded-2xl border p-3 transition " +
            (recAtiva
              ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "border-slate-200 dark:border-slate-700")
          }
        >
          <button type="button" onClick={() => setRecAtiva((v) => !v)} className="flex w-full items-center gap-3 text-left">
            <span
              className={
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition " +
                (recAtiva
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm"
                  : "bg-slate-300 dark:bg-slate-700")
              }
            >
              <Repeat size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Repetir lançamento
              </span>
              <span className="block text-xs leading-snug text-slate-500 dark:text-slate-400">
                {recAtiva
                  ? `${rotuloRecorrencia({ tipo: recTipo, cada: recCada })} · ${recFim ? "até " + fmtData(recFim) : "sem término"}`
                  : "Aluguel, mensalidade, assinatura… eu programo os próximos vencimentos."}
              </span>
            </span>
            {/* interruptor liga/desliga */}
            <span
              aria-hidden
              className={
                "relative h-6 w-11 shrink-0 rounded-full transition " +
                (recAtiva ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
                  (recAtiva ? "left-[22px]" : "left-0.5")
                }
              />
            </span>
          </button>

          {recAtiva && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(RECORRENCIAS).map(([id, def]) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setRecTipo(id)}
                    className={
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                      (recTipo === id
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-700")
                    }
                  >
                    {def.rotulo}
                  </button>
                ))}
              </div>

              {recTipo === "dias" && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Repetir a cada
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={recCada}
                    onChange={(e) => setRecCada(e.target.value)}
                    className={inputCls + " !w-20 text-center"}
                  />
                  dias
                </div>
              )}

              <Campo label="Repetir até">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRecFim("")}
                    className={
                      "shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition " +
                      (!recFim
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700")
                    }
                  >
                    Sem término
                  </button>
                  <input
                    type="date"
                    value={recFim}
                    min={t.data || undefined}
                    onChange={(e) => setRecFim(e.target.value)}
                    className={inputCls + " flex-1"}
                  />
                </div>
              </Campo>

              {previa && (
                <div className="rounded-xl border border-emerald-100 bg-white/80 p-2.5 dark:border-emerald-900/60 dark:bg-slate-900/50">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    <CalendarDays size={12} /> Próximos vencimentos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {previa.datas.map((d) => (
                      <span
                        key={d}
                        className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        {fmtData(d)}
                      </span>
                    ))}
                    {(previa.total === null || previa.total > previa.datas.length) && (
                      <span className="px-1 py-1 text-xs text-slate-500 dark:text-slate-400">…</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
                    {previa.total !== null
                      ? `${previa.estourou ? "Mais de " : ""}${previa.total} lançamento${previa.total > 1 ? "s" : ""} até ${fmtData(recFim)}.`
                      : "Sem data final — deixo sempre os próximos 12 meses programados."}
                  </p>
                </div>
              )}

              {inicial?.id && recInicial && recMudou && (
                <p className="text-xs leading-snug text-amber-600 dark:text-amber-400">
                  A mudança vale desta conta em diante — as anteriores ficam como estão.
                </p>
              )}
            </div>
          )}
        </div>

        {empresarial && ehReceita && espaco.clientes.length > 0 && (
          <Campo label="Cliente (opcional)">
            <select
              value={t.clienteId || ""}
              onChange={(e) => set("clienteId", e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {espaco.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
        )}
        {empresarial && !ehReceita && (
          <div className="grid grid-cols-2 gap-3">
            {espaco.fornecedores.length > 0 && (
              <Campo label="Fornecedor (opcional)">
                <select
                  value={t.fornecedorId || ""}
                  onChange={(e) => set("fornecedorId", e.target.value)}
                  className={inputCls}
                >
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
                <select
                  value={t.centroCustoId || ""}
                  onChange={(e) => set("centroCustoId", e.target.value)}
                  className={inputCls}
                >
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
        {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        <BotaoPrimario className="w-full justify-center">
          <Check size={16} /> Salvar
        </BotaoPrimario>
      </form>
    </Modal>
  );
}
