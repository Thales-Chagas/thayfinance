import React, { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import emblemaUrl from "../../emblema.webp";
import bgLoginUrl from "../../bg-login.webp";

/* ============================================================
   PEÇAS DAS TELAS DE ENTRADA (login, cadastro, recuperação, PIN)
   Identidade escura com verde-menta, sem cartão: o formulário fica
   direto sobre o fundo, com o brilho da imagem só no topo.
   ============================================================ */

// Fundo + marca + rodapé. `titulo`/`subtitulo` encolhem quando o teclado abre.
export function LayoutAuth({ titulo, subtitulo, topo, children, rodape = true, marcaCompacta = false }) {
  return (
    <div className="auth-raiz relative min-h-[100dvh] overflow-x-hidden bg-[#041317] text-[#e8f5f1]">
      {/* brilho do topo (imagem da marca se apagando no escuro) */}
      <div
        aria-hidden
        className="auth-brilho pointer-events-none absolute inset-x-0 top-0 h-[58vh]"
        style={{
          backgroundImage: `url(${bgLoginUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center 70%",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,.9) 0%, rgba(0,0,0,.55) 45%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,.9) 0%, rgba(0,0,0,.55) 45%, transparent 100%)",
        }}
      />
      <div className="auth-conteudo relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-6">
        <div className="flex items-center gap-2.5 pt-5">
          <img src={emblemaUrl} alt="" className={marcaCompacta ? "h-9 w-9" : "h-11 w-11"} />
          <span className="text-lg font-bold tracking-tight">Thayfinance</span>
        </div>
        {topo}
        {titulo && (
          <div className="auth-titulo anim-auth mt-9">
            <h1 className="text-[1.9rem] font-bold leading-tight tracking-tight text-white">{titulo}</h1>
            {subtitulo && <p className="mt-2 text-base leading-snug text-[#9fb8b1]">{subtitulo}</p>}
          </div>
        )}
        {/* empurra o formulário para a metade de baixo (alcance do polegar) */}
        <div className="auth-espaco min-h-8 flex-1" />
        {children}
        {rodape && (
          <p className="flex items-center justify-center gap-1.5 py-5 text-sm text-[#7f9a93]">
            <Lock size={14} aria-hidden /> Conexão protegida
          </p>
        )}
      </div>
    </div>
  );
}

const campoBase =
  "h-13 w-full rounded-xl border bg-[#0a1d23] px-4 text-base text-[#e8f5f1] placeholder:text-[#5f7d76] outline-none transition focus:border-[#3ee0a8] focus:ring-4 focus:ring-[#3ee0a8]/15";

// Campo com rótulo acima, erro abaixo (ligado por aria-describedby)
export function CampoTexto({ id, rotulo, erro, dica, direita, entradaRef, className = "", children, ...props }) {
  const idErro = erro ? `${id}-erro` : undefined;
  const idDica = dica && !erro ? `${id}-dica` : undefined;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-[#b7cdc6]">
          {rotulo}
        </label>
        {direita}
      </div>
      <div className="relative">
        <input
          id={id}
          ref={entradaRef}
          aria-invalid={erro ? true : undefined}
          aria-describedby={idErro || idDica}
          className={campoBase + " " + (erro ? "border-[#ff8b80]" : "border-[#1c3a40]") + (children ? " pr-13" : "")}
          {...props}
        />
        {children}
      </div>
      {erro ? (
        <p id={idErro} className="mt-1.5 flex items-start gap-1.5 text-sm text-[#ff8b80]">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden /> {erro}
        </p>
      ) : dica ? (
        <div id={idDica} className="mt-1.5 text-sm text-[#8fa9a2]">
          {dica}
        </div>
      ) : null}
    </div>
  );
}

// Senha com botão de mostrar/ocultar (44px) e aviso de Caps Lock
export function CampoSenha(props) {
  const [ver, setVer] = useState(false);
  const [caps, setCaps] = useState(false);
  const verificarCaps = (e) => setCaps(!!e.getModifierState?.("CapsLock"));
  return (
    <CampoTexto
      {...props}
      type={ver ? "text" : "password"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      onKeyUp={verificarCaps}
      onKeyDown={verificarCaps}
      dica={caps && !props.erro ? "Caps Lock ligado." : props.dica}
    >
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={ver}
        className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#8fa9a2] transition hover:text-[#3ee0a8] focus-visible:text-[#3ee0a8]"
      >
        {ver ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </CampoTexto>
  );
}

// Botão principal: verde-menta sólido com texto escuro; trava enquanto envia
export function BotaoEnviar({ carregando, textoCarregando, children, className = "", ...props }) {
  return (
    <button
      type="submit"
      disabled={carregando}
      aria-busy={carregando || undefined}
      className={
        "flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#3ee0a8] text-base font-bold text-[#03281d] transition hover:bg-[#5ce8b8] active:scale-[0.99] disabled:cursor-wait disabled:opacity-80 " +
        className
      }
      {...props}
    >
      {carregando ? (
        <>
          <Loader2 size={19} className="animate-spin" aria-hidden /> {textoCarregando}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function BotaoSecundario({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={
        "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#1c3a40] text-base font-semibold text-[#d5e6e0] transition hover:bg-white/5 disabled:opacity-60 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkAuth({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={"inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-[#3ee0a8] transition hover:text-[#7cf0c8] disabled:text-[#5f7d76] " + className}
      {...props}
    >
      {children}
    </button>
  );
}

// Aviso de erro/sucesso anunciado pelo leitor de tela
export function Aviso({ tipo = "erro", children }) {
  if (!children) return null;
  const erro = tipo === "erro";
  return (
    <div
      role={erro ? "alert" : "status"}
      className={
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug " +
        (erro ? "border-[#ff8b80]/40 bg-[#ff8b80]/10 text-[#ffc2bc]" : "border-[#3ee0a8]/35 bg-[#3ee0a8]/10 text-[#b9f5de]")
      }
    >
      {erro ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

// Entrar | Criar conta com indicador que desliza
export function AlternarModo({ valor, onMudar, opcoes }) {
  const i = Math.max(0, opcoes.findIndex(([v]) => v === valor));
  return (
    <div className="relative grid grid-cols-2 rounded-2xl border border-[#1c3a40] bg-white/[0.03] p-1" role="tablist" aria-label="Entrar ou criar conta">
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl bg-[#3ee0a8]/15 ring-1 ring-[#3ee0a8]/35 transition-transform duration-200"
        style={{ transform: `translateX(${i * 100}%)` }}
      />
      {opcoes.map(([v, r]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={valor === v}
          onClick={() => onMudar(v)}
          className={"relative h-11 rounded-xl text-sm font-semibold transition " + (valor === v ? "text-[#3ee0a8]" : "text-[#8fa9a2] hover:text-[#d5e6e0]")}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// Contagem regressiva (para "reenviar em 0:48")
export function useEspera(segundos = 60) {
  const [ate, setAte] = useState(0);
  const [, tique] = useState(0);
  const faltam = Math.max(0, Math.ceil((ate - Date.now()) / 1000));
  React.useEffect(() => {
    if (!faltam) return;
    const t = setInterval(() => tique((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [faltam]);
  return { faltam, iniciar: () => setAte(Date.now() + segundos * 1000), rotulo: `${Math.floor(faltam / 60)}:${String(faltam % 60).padStart(2, "0")}` };
}
