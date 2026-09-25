import React, { useState, useEffect } from "react";
import { User, Briefcase, Loader2, Cloud, AlertTriangle, Trash2, LogOut, Lock, Send, Lightbulb, Bell, BellOff } from "lucide-react";
import { statusTelegram } from "../telegramLink";
import { suportePush, assinaturaAtual, ativarPush, desativarPush } from "../push";

// Aba "Minha Conta": mostra quem está logado, ONDE os dados ficam (nuvem x
// aparelho) e o status do Telegram. Ajuda a entender por que o saldo pode
// parecer diferente entre o computador e o celular.
// Cartão de notificações push da aba Conta: liga/desliga neste aparelho.
export function CartaoNotificacoes({ userId, showToast }) {
  const suporte = suportePush();
  const [ativa, setAtiva] = useState(undefined); // undefined=carregando
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    assinaturaAtual()
      .then((s) => vivo && setAtiva(!!s))
      .catch(() => vivo && setAtiva(false));
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      if (ativa) {
        await desativarPush();
        setAtiva(false);
        showToast?.("Notificações desligadas neste aparelho.");
      } else {
        await ativarPush(userId);
        setAtiva(true);
        showToast?.("Notificações ativadas! 🔔");
      }
    } catch (e) {
      showToast?.(e.message || "Não deu certo. Tente de novo.", true, 6000);
    } finally {
      setOcupado(false);
    }
  }

  const descricao =
    suporte === "ios-precisa-instalar"
      ? "No iPhone, primeiro instale o app na tela de início (veja em Dicas do app)."
      : suporte === "bloqueado"
        ? "As notificações estão bloqueadas nas configurações do navegador."
        : suporte === "sem-suporte"
          ? "Este navegador não aceita notificações."
          : ativa === undefined
            ? "Verificando..."
            : ativa
              ? "Ativas neste aparelho ✅ — contas a vencer e lembrete de anotar os gastos."
              : "Avisa das contas a vencer e, de tempos em tempos, lembra de anotar os gastos.";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Notificações no celular
          </h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
        </div>
        {suporte === "ok" && ativa !== undefined && (
          <button
            onClick={alternar}
            disabled={ocupado}
            className={
              "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-50 " +
              (ativa
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950")
            }
          >
            {ocupado ? (
              <Loader2 size={15} className="animate-spin" />
            ) : ativa ? (
              <BellOff size={15} />
            ) : (
              <Bell size={15} />
            )}
            {ativa ? "Desativar" : "Ativar"}
          </button>
        )}
      </div>
    </div>
  );
}

export function PaginaConta({ login, sessao, userId, onConectarTelegram, onLimparDados, onSair, showToast, onVerTour }) {
  const email = sessao?.user?.email || null;
  const naNuvem = !!sessao;
  const [tg, setTg] = useState(undefined); // undefined=carregando | null=não | obj=sim
  const [alvoLimpar, setAlvoLimpar] = useState("pessoal"); // qual espaço limpar
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);

  function limpar() {
    onLimparDados?.(alvoLimpar);
    setConfirmandoLimpar(false);
    showToast?.(`Dados ${alvoLimpar === "empresarial" ? "empresariais" : "pessoais"} apagados.`);
  }

  useEffect(() => {
    let vivo = true;
    if (userId) {
      statusTelegram(userId).then((v) => vivo && setTg(v)).catch(() => vivo && setTg(null));
    } else {
      setTg(null);
    }
    return () => {
      vivo = false;
    };
  }, [userId]);

  const Linha = ({ rotulo, children }) => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{rotulo}</span>
      <span className="text-right text-sm font-medium text-slate-800 dark:text-slate-100">{children}</span>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      {/* Cartão do perfil */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {login?.foto ? (
          <img src={login.foto} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {(login?.nome || email || "?").trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">{login?.nome || "Minha conta"}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{email || "Conta local (sem nuvem)"}</p>
        </div>
      </div>

      {/* Onde ficam os dados */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-1 text-sm font-bold text-slate-700 dark:text-slate-200">Seus dados</h3>
        <Linha rotulo="Onde ficam guardados">
          {naNuvem ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Cloud size={14} /> Na nuvem
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Lock size={14} /> Só neste aparelho
            </span>
          )}
        </Linha>
        <Linha rotulo="E-mail da conta">{email || "—"}</Linha>
        <Linha rotulo="Identificador">
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{userId ? userId.slice(0, 8) + "…" : "—"}</span>
        </Linha>
      </div>

      {/* Dicas do app (reabre o tour de boas-vindas) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Dicas do app</h3>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Instalar no celular, Face ID / digital e o robô do Telegram.
            </p>
          </div>
          <button
            onClick={onVerTour}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
          >
            <Lightbulb size={15} /> Ver dicas
          </button>
        </div>
      </div>

      {/* Telegram */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Bot do Telegram</h3>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {tg === undefined ? "Verificando..." : tg ? "Conectado ✅" : "Não conectado"}
            </p>
          </div>
          {userId && (
            <button
              onClick={onConectarTelegram}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              <Send size={15} /> {tg ? "Gerenciar" : "Conectar"}
            </button>
          )}
        </div>
      </div>

      {/* Notificações push — só faz sentido logado na nuvem */}
      {userId && <CartaoNotificacoes userId={userId} showToast={showToast} />}

      {/* Explicação do saldo diferente entre aparelhos */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">O saldo aqui está diferente do celular?</p>
          <p className="text-amber-700/90 dark:text-amber-300/80">
            Cada aparelho mostra os dados de <b>onde ele está ligado</b>. Se um aparelho está{" "}
            <b>na nuvem</b> e o outro guarda os dados <b>só no próprio aparelho</b>, os saldos vão
            parecer diferentes. Para os dois baterem, entre com a <b>mesma conta</b> nos dois e use{" "}
            <b>Importar dados</b> para enviar o que estava só no aparelho para a nuvem.
          </p>
        </div>
      </div>

      {/* Zona de perigo — limpar dados de um espaço */}
      <div className="rounded-2xl border border-red-200 bg-white p-5 dark:border-red-900/60 dark:bg-slate-900">
        <h3 className="flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400">
          <Trash2 size={16} /> Limpar dados
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Apaga <b>todos</b> os dados do espaço escolhido (lançamentos, metas, clientes,
          fornecedores e centros de custo). As categorias voltam ao padrão. <b>Não dá pra desfazer.</b>
        </p>

        {/* escolher o espaço */}
        <div className="mt-4 flex gap-2">
          {[
            { id: "pessoal", label: "Pessoal", icon: User },
            { id: "empresarial", label: "Empresarial", icon: Briefcase },
          ].map((o) => {
            const ativo = alvoLimpar === o.id;
            return (
              <button
                key={o.id}
                onClick={() => {
                  setAlvoLimpar(o.id);
                  setConfirmandoLimpar(false);
                }}
                className={
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition " +
                  (ativo
                    ? "border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800")
                }
              >
                <o.icon size={15} /> {o.label}
              </button>
            );
          })}
        </div>

        {/* ação + confirmação */}
        {!confirmandoLimpar ? (
          <button
            onClick={() => setConfirmandoLimpar(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 size={15} /> Limpar dados {alvoLimpar === "empresarial" ? "empresariais" : "pessoais"}
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
            <p className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Tem certeza? Isso vai apagar <b>todos</b> os dados{" "}
              <b>{alvoLimpar === "empresarial" ? "Empresariais" : "Pessoais"}</b> de forma permanente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmandoLimpar(false)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={limpar}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Sim, apagar tudo
              </button>
            </div>
          </div>
        )}
      </div>

      {onSair && (
        <button
          onClick={onSair}
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <LogOut size={16} /> Sair da conta
        </button>
      )}
    </div>
  );
}
