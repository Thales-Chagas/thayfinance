import React, { useState, useEffect } from "react";
import { Check, Loader2, Send, Copy, RefreshCw } from "lucide-react";
import { gerarCodigoTelegram, statusTelegram, desconectarTelegram, BOT_URL, BOT_USERNAME } from "../telegramLink";
import { Modal } from "./ui";
import { useConfirmar } from "./Confirmar";

// Conectar o bot do Telegram à conta: o app gera um código de 6 números,
// a pessoa manda "/conectar 123456" no bot e o vínculo é criado sozinho.
export function ModalConectarTelegram({ userId, nome, onFechar, showToast }) {
  const confirmar = useConfirmar();
  const [carregando, setCarregando] = useState(true);
  const [vinculo, setVinculo] = useState(null); // { chat_id } se já conectado
  const [codigo, setCodigo] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    statusTelegram(userId)
      .then((v) => vivo && setVinculo(v))
      .catch(() => {})
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [userId]);

  async function gerar() {
    setGerando(true);
    try {
      const { codigo } = await gerarCodigoTelegram(userId, nome);
      setCodigo(codigo);
    } catch (e) {
      showToast(e?.message || "Não consegui gerar o código.", true, 5000);
    } finally {
      setGerando(false);
    }
  }

  async function desconectar() {
    const ok = await confirmar({ titulo: "Desligar o Telegram?", mensagem: "O robô deixa de lançar nesta conta. Você pode reconectar quando quiser.", confirmar: "Desligar", perigo: true });
    if (!ok) return;
    try {
      await desconectarTelegram(userId);
      setVinculo(null);
      setCodigo(null);
      showToast("Telegram desconectado.");
    } catch {
      showToast("Não consegui desconectar agora.", true);
    }
  }

  function copiarComando() {
    const texto = `/conectar ${codigo}`;
    navigator.clipboard?.writeText(texto).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      },
      () => {},
    );
  }

  return (
    <Modal titulo="Conectar Telegram" onFechar={onFechar}>
      {carregando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500 dark:text-slate-400">
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : vinculo ? (
        // ---- JÁ CONECTADO ----
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/50">
            <Check size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Telegram conectado ✅</p>
              <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-400/70">
                Mande áudio, foto de comprovante ou uma mensagem pro bot que eu lanço aqui na sua conta.
              </p>
            </div>
          </div>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Send size={16} /> Abrir o bot no Telegram
          </a>
          <button
            onClick={desconectar}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            Desconectar
          </button>
        </div>
      ) : (
        // ---- NÃO CONECTADO ----
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <Send size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Lance seus gastos por <b>áudio</b>, <b>foto do comprovante</b> ou <b>mensagem</b>, direto no Telegram.
              É rapidinho conectar:
            </p>
          </div>

          {!codigo ? (
            <button
              onClick={gerar}
              disabled={gerando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {gerando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Gerar código de conexão
            </button>
          ) : (
            <div className="space-y-4">
              <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">1</span>
                  <span>
                    Abra o bot{" "}
                    <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 underline underline-offset-2 dark:text-emerald-400">
                      @{BOT_USERNAME}
                    </a>{" "}
                    no Telegram.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">2</span>
                  <span>Envie a mensagem abaixo pra ele:</span>
                </li>
              </ol>

              <button
                onClick={copiarComando}
                title="Toque para copiar"
                className="flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 px-4 py-3 text-left transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
              >
                <span className="font-mono text-lg font-bold tracking-wide text-slate-800 dark:text-slate-100">
                  /conectar {codigo}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {copiado ? <Check size={14} /> : <Copy size={14} />}
                  {copiado ? "Copiado" : "Copiar"}
                </span>
              </button>

              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Send size={16} /> Abrir o bot no Telegram
              </a>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>O código vale por 15 minutos.</span>
                <button onClick={gerar} disabled={gerando} className="flex items-center gap-1 underline-offset-2 hover:underline disabled:opacity-60">
                  <RefreshCw size={12} className={gerando ? "animate-spin" : ""} /> Gerar outro
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
