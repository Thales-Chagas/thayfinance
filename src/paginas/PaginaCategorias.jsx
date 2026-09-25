import React, { useState } from "react";
import { Plus, Pencil, Trash2, Palette } from "lucide-react";
import { uid, fmtBRL, soma } from "../lib/formato";
import { gradPorId, gradientePorNome, gradCat, cssGrad } from "../lib/cores";
import { SeletorGradiente, Card, BotaoPrimario, inputCls } from "../components/ui";

/* ============================================================
   CATEGORIAS
   ============================================================ */

export function PaginaCategorias({ espaco, atualizar, avisar }) {
  const [nova, setNova] = useState("");
  const [novaCor, setNovaCor] = useState(null); // null = automática pelo nome
  const [editando, setEditando] = useState(null); // {id, nome}
  const [corAberta, setCorAberta] = useState(null); // id da categoria com a paleta aberta
  const sugestao = gradientePorNome(nova);
  const usos = (id) => espaco.transacoes.filter((t) => t.categoriaId === id).length;
  const totalDe = (id) => soma(espaco.transacoes.filter((t) => t.categoriaId === id));

  function adicionar(e) {
    e.preventDefault();
    const nome = nova.trim();
    if (!nome) return;
    if (espaco.categorias.some((c) => c.nome.toLowerCase() === nome.toLowerCase()))
      return avisar("Essa categoria já existe.", true);
    atualizar((esp) => ({
      ...esp,
      categorias: [...esp.categorias, { id: uid(), nome, cor: novaCor || sugestao.id }],
    }));
    setNova("");
    setNovaCor(null);
  }

  function trocarCor(id, cor) {
    atualizar((esp) => ({
      ...esp,
      categorias: esp.categorias.map((x) => (x.id === id ? { ...x, cor } : x)),
    }));
    setCorAberta(null);
  }

  return (
    <div className="space-y-4">
      {/* --- criador: preview ao vivo + nome + cor --- */}
      <Card>
        <form onSubmit={adicionar} className="space-y-3">
          <div className="flex gap-2.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm transition-all"
              style={{ background: cssGrad(gradPorId(novaCor) || sugestao) }}
            >
              {(nova.trim()[0] || "+").toUpperCase()}
            </div>
            <input
              type="text"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="Nome da nova categoria (ex.: Mercado, Lazer, Salário...)"
              className={inputCls + " flex-1"}
            />
            <BotaoPrimario>
              <Plus size={16} /> Criar
            </BotaoPrimario>
          </div>
          <SeletorGradiente valor={novaCor} sugestao={sugestao} onChange={setNovaCor} />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {novaCor
              ? `Cor escolhida: ${gradPorId(novaCor)?.nome}`
              : nova.trim()
                ? `Cor automática pela categoria: ${sugestao.nome} — toque numa bolinha pra trocar`
                : "A cor é escolhida sozinha pelo nome — ou toque numa bolinha pra definir"}
          </p>
        </form>
      </Card>

      {/* --- grade de categorias --- */}
      {espaco.categorias.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma categoria ainda. Crie a primeira aí em cima! 🏷️
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {espaco.categorias.map((c) => {
            const g = gradCat(c);
            const n = usos(c.id);
            return (
              <div
                key={c.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
              >
                {/* filete gradiente no topo */}
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: cssGrad(g) }} />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCorAberta(corAberta === c.id ? null : c.id)}
                    title="Trocar cor"
                    aria-label={"Trocar cor de " + c.nome}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm transition hover:scale-105"
                    style={{ background: cssGrad(g) }}
                  >
                    {c.nome.trim()[0]?.toUpperCase() || "?"}
                  </button>
                  <div className="min-w-0 flex-1">
                    {editando?.id === c.id ? (
                      <input
                        type="text"
                        value={editando.nome}
                        onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                        onBlur={() => {
                          const nome = editando.nome.trim();
                          if (nome)
                            atualizar((esp) => ({
                              ...esp,
                              categorias: esp.categorias.map((x) => (x.id === c.id ? { ...x, nome } : x)),
                            }));
                          setEditando(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        className={inputCls + " !py-1.5 w-full"}
                        autoFocus
                      />
                    ) : (
                      <>
                        <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{c.nome}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {n} lançamento{n !== 1 ? "s" : ""}
                          {n > 0 && <> · {fmtBRL(totalDe(c.id))}</>}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-60 transition group-hover:opacity-100">
                    <button
                      onClick={() => setCorAberta(corAberta === c.id ? null : c.id)}
                      className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                      aria-label="Trocar cor"
                      title="Trocar cor"
                    >
                      <Palette size={14} />
                    </button>
                    <button
                      onClick={() => setEditando({ id: c.id, nome: c.nome })}
                      className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                      aria-label="Renomear"
                      title="Renomear"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (usos(c.id) > 0)
                          return avisar("Essa categoria tem lançamentos. Mova-os antes de excluir.", true);
                        atualizar((esp) => ({ ...esp, categorias: esp.categorias.filter((x) => x.id !== c.id) }));
                      }}
                      className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                      aria-label="Excluir"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {corAberta === c.id && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                    <SeletorGradiente valor={c.cor} sugestao={gradientePorNome(c.nome)} onChange={(cor) => trocarCor(c.id, cor || gradientePorNome(c.nome).id)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
