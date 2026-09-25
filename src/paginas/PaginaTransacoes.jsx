import React, { useState } from "react";
import { Plus, Pencil, Trash2, Image as ImageIcon, Repeat } from "lucide-react";
import { MESES } from "../lib/constantes";
import { fmtBRL, hojeISO, fmtData, mesPrefixo, soma } from "../lib/formato";
import { rotuloRecorrencia } from "../lib/recorrencia";
import { Card, BotaoPrimario, Modal, ChipStatus } from "../components/ui";
import { FormTransacao } from "../components/FormTransacao";
import { CapturaIA } from "../components/CapturaIA";
import { ModalExcluirConta } from "../components/ModaisConta";

/* ============================================================
   LISTA DE LANÇAMENTOS (Receitas / Despesas)
   ============================================================ */

export function PaginaTransacoes({ tipo, espaco, empresarial, ano, mesIdx, acoes, showToast }) {
  const [form, setForm] = useState(null); // null | {} novo | transacao p/ editar
  const [verComprovante, setVerComprovante] = useState(null); // dataURL p/ visualizar
  const [excluindo, setExcluindo] = useState(null); // transacao aguardando confirmação
  const prefixo = mesPrefixo(ano, mesIdx);
  const lista = espaco.transacoes
    .filter((t) => t.tipo === tipo && t.data.startsWith(prefixo))
    .sort((a, b) => b.data.localeCompare(a.data));

  // Recebe o resultado da IA e abre o formulário já preenchido p/ conferir
  function abrirRevisao(ai) {
    const ENTRADAS = ["Faturamento", "Salário"];
    const ehRec = ai.tipo === "receita";
    const alvo = (ai.categoria || "").trim().toLowerCase();
    const cat =
      espaco.categorias.find((c) => c.nome.toLowerCase() === alvo) ||
      (alvo &&
        espaco.categorias.find(
          (c) => c.nome.toLowerCase().includes(alvo) || alvo.includes(c.nome.toLowerCase())
        )) ||
      (ehRec
        ? espaco.categorias.find((c) => ENTRADAS.includes(c.nome))
        : espaco.categorias.find((c) => !ENTRADAS.includes(c.nome))) ||
      espaco.categorias[0];
    setForm({
      tipo: ehRec ? "receita" : "despesa",
      data: ai.data || hojeISO(),
      categoriaId: cat?.id || "",
      valor: Number(ai.valor) || 0,
      descricao: ai.descricao || ai.estabelecimento || "",
      status: "ok",
      clienteId: "",
      fornecedorId: "",
      centroCustoId: "",
      comprovante: ai.comprovante || null,
    });
  }
  const catNome = (id) => espaco.categorias.find((c) => c.id === id)?.nome || "—";
  const totalOk = soma(lista.filter((t) => t.status === "ok"));
  const totalPend = soma(lista.filter((t) => t.status === "pendente"));
  const ehReceita = tipo === "receita";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {ehReceita ? "Recebido" : "Pago"}: {fmtBRL(totalOk)}
          </span>
          {totalPend > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Pendente: {fmtBRL(totalPend)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CapturaIA onResultado={abrirRevisao} showToast={showToast} />
          <BotaoPrimario onClick={() => setForm({})}>
            <Plus size={16} /> {ehReceita ? (empresarial ? "Novo faturamento" : "Nova receita") : "Nova despesa"}
          </BotaoPrimario>
        </div>
      </div>

      <Card>
        {lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum lançamento em {MESES[mesIdx]} de {ano}. Toque em "{ehReceita ? "Nova receita" : "Nova despesa"}" para começar.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lista.map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t.descricao || catNome(t.categoriaId)}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {fmtData(t.data)} · {catNome(t.categoriaId)}
                    {t.recorrencia && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                        <Repeat size={10} /> {rotuloRecorrencia(t.recorrencia)}
                      </span>
                    )}
                  </p>
                </div>
                <ChipStatus status={t.status} tipo={t.tipo} />
                <span
                  className={
                    "w-24 text-right text-sm font-semibold tabular-nums " +
                    (ehReceita ? "text-emerald-600" : "text-slate-700 dark:text-slate-200")
                  }
                >
                  {fmtBRL(t.valor)}
                </span>
                <div className="flex gap-0.5">
                  {t.comprovante && (
                    <button
                      onClick={() => setVerComprovante(t.comprovante)}
                      className="rounded-lg p-1.5 text-emerald-500 transition hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      aria-label="Ver comprovante"
                    >
                      <ImageIcon size={15} />
                    </button>
                  )}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {form !== null && (
        <FormTransacao
          tipo={tipo}
          inicial={form && Object.keys(form).length ? form : null}
          espaco={espaco}
          empresarial={empresarial}
          onSalvar={acoes.salvar}
          onCriarCategoria={acoes.criarCategoria}
          onFechar={() => setForm(null)}
        />
      )}

      {verComprovante && (
        <Modal titulo="Comprovante" onFechar={() => setVerComprovante(null)}>
          <img src={verComprovante} alt="Comprovante" className="w-full rounded-xl" />
        </Modal>
      )}

      {excluindo && (
        <ModalExcluirConta
          transacao={excluindo}
          onExcluir={acoes.excluir}
          onExcluirSerie={acoes.excluirSerie}
          onFechar={() => setExcluindo(null)}
        />
      )}
    </div>
  );
}
