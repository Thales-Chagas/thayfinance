import React, { useState } from "react";
import { Check, Plus, Pencil, Trash2 } from "lucide-react";
import { uid } from "../lib/formato";
import { useConfirmar } from "../components/Confirmar";
import { Card, BotaoPrimario, inputCls, Campo, Modal } from "../components/ui";

/* ============================================================
   CADASTROS EMPRESARIAIS (clientes, fornecedores, centros de custo)
   ============================================================ */

export function PaginaCadastro({ titulo, singular, itens, comContato, atualizarLista, extraInfo }) {
  const confirmar = useConfirmar();
  const [form, setForm] = useState(null);

  function FormItem({ inicial, onFechar }) {
    const [it, setIt] = useState(inicial || { nome: "", telefone: "", email: "", obs: "" });
    const [erro, setErro] = useState("");
    function salvar(e) {
      e.preventDefault();
      if (!it.nome.trim()) return setErro("Digite o nome.");
      atualizarLista((lista) =>
        it.id ? lista.map((x) => (x.id === it.id ? it : x)) : [...lista, { ...it, id: uid() }]
      );
      onFechar();
    }
    return (
      <Modal titulo={(inicial ? "Editar " : "Novo ") + singular} onFechar={onFechar}>
        <form onSubmit={salvar} className="space-y-3">
          <Campo label="Nome">
            <input type="text" value={it.nome} onChange={(e) => setIt({ ...it, nome: e.target.value })} className={inputCls} autoFocus />
          </Campo>
          {comContato && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Telefone">
                  <input type="tel" value={it.telefone || ""} onChange={(e) => setIt({ ...it, telefone: e.target.value })} className={inputCls} />
                </Campo>
                <Campo label="E-mail">
                  <input type="email" value={it.email || ""} onChange={(e) => setIt({ ...it, email: e.target.value })} className={inputCls} />
                </Campo>
              </div>
              <Campo label="Observações">
                <input type="text" value={it.obs || ""} onChange={(e) => setIt({ ...it, obs: e.target.value })} className={inputCls} />
              </Campo>
            </>
          )}
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          <BotaoPrimario className="w-full justify-center">
            <Check size={16} /> Salvar
          </BotaoPrimario>
        </form>
      </Modal>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BotaoPrimario onClick={() => setForm({})}>
          <Plus size={16} /> {"Novo " + singular}
        </BotaoPrimario>
      </div>
      <Card>
        {itens.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum cadastro ainda.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {itens.map((it) => (
              <div key={it.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{it.nome}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {extraInfo
                      ? extraInfo(it)
                      : [it.telefone, it.email, it.obs].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <button onClick={() => setForm(it)} className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Editar">
                  <Pencil size={15} />
                </button>
                <button
                  onClick={async () => {
                    if (await confirmar({ titulo: `Excluir ${it.nome}?`, mensagem: `O cadastro de ${it.nome} será apagado. Os lançamentos ligados a ele continuam.`, confirmar: "Excluir", perigo: true }))
                      atualizarLista((lista) => lista.filter((x) => x.id !== it.id));
                  }}
                  className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                  aria-label="Excluir"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
      {form !== null && <FormItem inicial={form.id ? form : null} onFechar={() => setForm(null)} />}
    </div>
  );
}
