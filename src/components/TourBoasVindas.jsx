import React, { useState } from "react";
import { Download, Check, Loader2, Camera, Mic, ScanFace, Lock, ArrowRight, Send, Smartphone, Share, SquarePlus, EllipsisVertical, CircleCheck } from "lucide-react";
import { Modal } from "./ui";

// Instalação como aplicativo (PWA). O Chrome no Android/PC dispara
// beforeinstallprompt bem antes do React montar — guardamos o evento no módulo
// pra oferecer o botão "Instalar agora" com 1 toque. No iPhone esse evento não
// existe: lá a instalação é sempre manual (Compartilhar → Adicionar à Tela de Início).
export let eventoInstalacao = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalacao = e;
  });
  window.addEventListener("appinstalled", () => {
    eventoInstalacao = null;
  });
}
export const EH_IOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad novo se apresenta como Mac, mas tem tela de toque
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export const EH_ANDROID = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
export function rodandoComoApp() {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

// Tour de boas-vindas em 3 passos: instalar como aplicativo, ativar a
// biometria e conhecer o bot do Telegram. Aparece 1x por aparelho; pode ser
// revisto na aba Conta.
export function TourBoasVindas({ onFechar, bioDisponivel, bioAtivo, onAtivarBiometria, onAbrirTelegram }) {
  const [passo, setPasso] = useState(0);
  // Aba Android/iPhone do passo de instalação: pré-seleciona pelo aparelho.
  const [sis, setSis] = useState(EH_IOS ? "ios" : "android");
  const [instalando, setInstalando] = useState(false);
  const [instalouAgora, setInstalouAgora] = useState(false);
  const jaEhApp = rodandoComoApp() || instalouAgora;
  const TOTAL = 3;

  // Botão nativo "Instalar agora" (Chrome no Android/PC guarda o evento).
  async function instalarAgora() {
    if (!eventoInstalacao) return;
    setInstalando(true);
    try {
      eventoInstalacao.prompt();
      const { outcome } = await eventoInstalacao.userChoice;
      if (outcome === "accepted") setInstalouAgora(true);
      eventoInstalacao = null;
    } catch {
      /* usuário fechou o aviso */
    } finally {
      setInstalando(false);
    }
  }

  const Item = ({ icone: Icone, children }) => (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <Icone size={15} />
      </span>
      <span className="text-sm text-slate-600 dark:text-slate-300">{children}</span>
    </li>
  );

  const titulos = ["Use como aplicativo 📱", "Proteja com sua digital 🔒", "Lance pelo Telegram 🤖"];

  return (
    <Modal titulo={titulos[passo]} onFechar={onFechar}>
      <div className="space-y-4">
        {/* ---- PASSO 1: instalar como app ---- */}
        {passo === 0 && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              O Thayfinance pode virar um <b>aplicativo de verdade</b> no seu celular: ícone na tela
              inicial, abre em tela cheia e sem precisar digitar o endereço.
            </p>

            {jaEhApp ? (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/50">
                <CircleCheck size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Você já está usando como aplicativo. Tudo certo por aqui!
                </p>
              </div>
            ) : (
              <>
                {eventoInstalacao && (
                  <button
                    onClick={instalarAgora}
                    disabled={instalando}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {instalando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Instalar agora
                  </button>
                )}

                <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {[
                    ["android", "Android"],
                    ["ios", "iPhone / iPad"],
                  ].map(([v, r]) => (
                    <button
                      key={v}
                      onClick={() => setSis(v)}
                      className={
                        "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition " +
                        (sis === v
                          ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                          : "text-slate-500 dark:text-slate-400")
                      }
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {sis === "android" ? (
                  <ul className="space-y-3">
                    <Item icone={Smartphone}>
                      Abra <b>www.thayfinance.com</b> no <b>Chrome</b> do celular.
                    </Item>
                    <Item icone={EllipsisVertical}>
                      Toque nos <b>3 pontinhos</b> no canto de cima, à direita.
                    </Item>
                    <Item icone={Download}>
                      Escolha <b>"Instalar aplicativo"</b> (ou "Adicionar à tela inicial") e confirme.
                    </Item>
                  </ul>
                ) : (
                  <ul className="space-y-3">
                    <Item icone={Smartphone}>
                      Abra <b>www.thayfinance.com</b> no <b>Safari</b> (tem que ser o Safari).
                    </Item>
                    <Item icone={Share}>
                      Toque no botão <b>Compartilhar</b> — o quadradinho com a setinha pra cima, na
                      barra de baixo.
                    </Item>
                    <Item icone={SquarePlus}>
                      Role a lista e escolha <b>"Adicionar à Tela de Início"</b>, depois toque em{" "}
                      <b>Adicionar</b>.
                    </Item>
                  </ul>
                )}

                <p className="text-xs text-slate-400">
                  Pronto: o ícone do Thayfinance aparece junto com os outros aplicativos.
                </p>
              </>
            )}
          </>
        )}

        {/* ---- PASSO 2: biometria ---- */}
        {passo === 1 && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Seus dados financeiros são só seus. Se quiser, o app pode pedir o seu{" "}
              <b>rosto (Face ID)</b> ou a sua <b>digital</b> pra abrir — igual aplicativo de banco.
            </p>

            {bioAtivo ? (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/50">
                <CircleCheck size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Face ID / digital já está ativo neste aparelho. ✅
                </p>
              </div>
            ) : bioDisponivel ? (
              <>
                <ul className="space-y-3">
                  <Item icone={ScanFace}>
                    Toque no botão abaixo e confirme com o rosto ou o dedo quando o celular pedir.
                  </Item>
                  <Item icone={Lock}>
                    O PIN continua valendo como reserva, se a biometria falhar.
                  </Item>
                </ul>
                <button
                  onClick={onAtivarBiometria}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <ScanFace size={16} /> Ativar Face ID / digital
                </button>
              </>
            ) : (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                Este navegador/aparelho não ofereceu leitor facial ou de digital. No <b>celular</b>,
                depois de instalar o app, é só tocar no ícone <ScanFace size={14} className="inline" />{" "}
                no topo da tela pra ativar.
              </div>
            )}

            <p className="text-xs text-slate-400">
              É totalmente opcional — dá pra ligar ou desligar quando quiser, no ícone{" "}
              <ScanFace size={12} className="inline" /> do app.
            </p>
          </>
        )}

        {/* ---- PASSO 3: bot do Telegram ---- */}
        {passo === 2 && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              O jeito mais rápido de lançar um gasto: <b>mandar mensagem pro nosso robô no
              Telegram</b>. Ele entende, registra na sua conta e responde na hora.
            </p>
            <ul className="space-y-3">
              <Item icone={Mic}>
                Mande um <b>áudio</b>: <i>"gastei 50 reais no mercado hoje"</i> — vira lançamento
                sozinho.
              </Item>
              <Item icone={Camera}>
                Mande a <b>foto do comprovante</b>: ele lê o valor, a data e o local.
              </Item>
              <Item icone={Send}>
                Ou escreva uma <b>mensagem</b> simples, do seu jeito.
              </Item>
            </ul>
            <button
              onClick={onAbrirTelegram}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Send size={16} /> Conectar meu Telegram
            </button>
            <p className="text-xs text-slate-400">
              Se preferir deixar pra depois, o botão "Conectar Telegram" fica sempre no menu do app.
            </p>
          </>
        )}

        {/* ---- Rodapé: bolinhas + navegação ---- */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL }, (_, i) => (
              <button
                key={i}
                onClick={() => setPasso(i)}
                aria-label={`Passo ${i + 1}`}
                className={
                  "h-2 rounded-full transition-all " +
                  (i === passo
                    ? "w-5 bg-emerald-500"
                    : "w-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600")
                }
              />
            ))}
          </div>
          <div className="flex gap-2">
            {passo > 0 && (
              <button
                onClick={() => setPasso((p) => p - 1)}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Voltar
              </button>
            )}
            {passo < TOTAL - 1 ? (
              <button
                onClick={() => setPasso((p) => p + 1)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Próximo <ArrowRight size={15} />
              </button>
            ) : (
              <button
                onClick={onFechar}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Check size={15} /> Entendi!
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
