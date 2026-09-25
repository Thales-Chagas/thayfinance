import React, { useEffect, useRef, useState } from "react";
import { Camera, ScanFace, Delete, ArrowRight } from "lucide-react";
import { CropFotoModal } from "../components/CropFotoModal";
import { LayoutAuth, CampoTexto, BotaoEnviar, LinkAuth, Aviso } from "./auth/ComponentesAuth";

/* ============================================================
   TRANCA RÁPIDA DO APARELHO: criar o PIN (primeiro uso) ou
   desbloquear com PIN / Face ID. Mesma identidade escura do login.
   O PIN fica só neste aparelho (hash + salt), como antes.
   ============================================================ */

const pinValido = (p) => /^\d{4,6}$/.test(p);

export function TelaLogin({ modo, nome, foto, onCriar, onDesbloquear, onEsqueci, onBiometria, temBio }) {
  return modo === "setup" ? (
    <CriarPin onCriar={onCriar} />
  ) : (
    <Desbloquear nome={nome} foto={foto} onDesbloquear={onDesbloquear} onEsqueci={onEsqueci} onBiometria={onBiometria} temBio={temBio} />
  );
}

// ---------- Desbloquear: teclado numérico na tela ----------
function Desbloquear({ nome, foto, onDesbloquear, onEsqueci, onBiometria, temBio }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);
  const tentativa = useRef(0);
  const primeiroNome = (nome || "").trim().split(/\s+/)[0];

  // Tenta sozinho a partir de 4 dígitos (o PIN pode ter de 4 a 6). Só mostra
  // erro quando chega a 6 dígitos ou quando a pessoa toca em "Entrar".
  async function tentar(valor, mostrarErro) {
    if (!pinValido(valor)) {
      if (mostrarErro) setErro("Digite o PIN (4 a 6 números).");
      return;
    }
    const minha = ++tentativa.current;
    setVerificando(true);
    const ok = await onDesbloquear(valor);
    if (minha !== tentativa.current) return; // já digitou mais: resultado velho
    setVerificando(false);
    if (!ok && mostrarErro) {
      setErro("PIN incorreto. Tente de novo.");
      setPin("");
    }
  }

  function digitar(d) {
    if (pin.length >= 6) return;
    const novo = pin + d;
    setErro("");
    setPin(novo);
    if (novo.length >= 4) tentar(novo, novo.length === 6);
  }
  function apagar() {
    tentativa.current++;
    setErro("");
    setPin((p) => p.slice(0, -1));
  }

  // teclado físico (computador)
  useEffect(() => {
    function tecla(e) {
      if (/^\d$/.test(e.key)) digitar(e.key);
      else if (e.key === "Backspace") apagar();
      else if (e.key === "Enter") tentar(pin, true);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  async function usarBiometria() {
    setErro("");
    const ok = await onBiometria();
    if (!ok) setErro("Não reconheci. Use o PIN abaixo.");
  }

  const tecla =
    "flex h-16 items-center justify-center rounded-2xl text-2xl font-semibold text-white transition hover:bg-white/5 active:bg-white/10 active:scale-95 disabled:opacity-40";

  return (
    <LayoutAuth rodape={false} marcaCompacta>
      <div className="flex flex-col items-center pb-6 text-center">
        {foto ? (
          <img src={foto} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-[#3ee0a8]/60" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3ee0a8]/15 text-3xl font-bold text-[#3ee0a8] ring-1 ring-[#3ee0a8]/40">
            {(primeiroNome[0] || "?").toUpperCase()}
          </span>
        )}
        <h1 className="mt-4 text-2xl font-bold text-white">{primeiroNome ? `Olá, ${primeiroNome}` : "Olá!"}</h1>
        <p className="mt-1 text-base text-[#9fb8b1]">Digite seu PIN para entrar</p>

        {/* pontinhos do PIN */}
        <div className="mt-6 flex h-4 items-center gap-3.5" aria-live="polite" aria-label={`${pin.length} dígitos digitados`}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
            <span
              key={i}
              className={"h-3.5 w-3.5 rounded-full transition " + (i < pin.length ? (erro ? "bg-[#ff8b80]" : "bg-[#3ee0a8]") : "border-2 border-[#3a5a60]")}
            />
          ))}
        </div>
        <div className="mt-4 min-h-12 w-full">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>

        {temBio && (
          <button
            type="button"
            onClick={usarBiometria}
            className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#3ee0a8]/40 bg-[#3ee0a8]/10 text-base font-semibold text-[#3ee0a8] transition hover:bg-[#3ee0a8]/15"
          >
            <ScanFace size={20} /> Entrar com Face ID / digital
          </button>
        )}

        <div className="grid w-full max-w-xs grid-cols-3 gap-2" role="group" aria-label="Teclado do PIN">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => digitar(d)} className={tecla} aria-label={d}>
              {d}
            </button>
          ))}
          <button type="button" onClick={apagar} disabled={!pin} className={tecla} aria-label="Apagar">
            <Delete size={24} />
          </button>
          <button type="button" onClick={() => digitar("0")} className={tecla} aria-label="0">
            0
          </button>
          <button
            type="button"
            onClick={() => tentar(pin, true)}
            disabled={pin.length < 4 || verificando}
            className={tecla + " text-[#3ee0a8]"}
            aria-label="Entrar"
          >
            <ArrowRight size={26} />
          </button>
        </div>

        <LinkAuth onClick={onEsqueci} className="mt-4">
          Esqueci o PIN
        </LinkAuth>
      </div>
    </LayoutAuth>
  );
}

// ---------- Primeiro uso: nome, foto e PIN ----------
function CriarPin({ onCriar }) {
  const [nomeInput, setNomeInput] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pedirSempre, setPedirSempre] = useState(true);
  const [tentou, setTentou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [fotoNova, setFotoNova] = useState(null);
  const [arquivoCrop, setArquivoCrop] = useState(null);
  const fotoRef = useRef(null);

  const erroNome = tentou && !nomeInput.trim() ? "Digite como quer ser chamado(a)." : null;
  const erroPin = tentou && !pinValido(pin) ? "O PIN precisa ter de 4 a 6 números." : null;
  const erroPin2 = tentou && !erroPin && pin !== pin2 ? "Os dois PINs não são iguais." : null;

  async function criar(e) {
    e.preventDefault();
    if (carregando) return;
    setTentou(true);
    if (!nomeInput.trim() || !pinValido(pin) || pin !== pin2) return;
    setCarregando(true);
    await onCriar(nomeInput.trim(), pin, pedirSempre, fotoNova);
  }

  return (
    <LayoutAuth titulo="Proteja este aparelho" subtitulo="Crie um PIN para abrir o app aqui. Leva 10 segundos.">
      <form onSubmit={criar} className="space-y-4" noValidate>
        <input
          ref={fotoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setArquivoCrop(f);
            e.target.value = "";
          }}
        />
        {arquivoCrop && (
          <CropFotoModal
            file={arquivoCrop}
            onConfirmar={(d) => {
              setFotoNova(d);
              setArquivoCrop(null);
            }}
            onFechar={() => setArquivoCrop(null)}
          />
        )}
        <button type="button" onClick={() => fotoRef.current?.click()} className="flex min-h-14 w-full items-center gap-3 rounded-xl text-left" aria-label="Escolher foto (opcional)">
          {fotoNova ? (
            <img src={fotoNova} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-[#3ee0a8]/60" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-[#3a5a60] text-[#8fa9a2]">
              <Camera size={22} />
            </span>
          )}
          <span>
            <span className="block text-base font-semibold text-white">{fotoNova ? "Trocar foto" : "Adicionar foto"}</span>
            <span className="block text-sm text-[#8fa9a2]">Opcional</span>
          </span>
        </button>
        <CampoTexto
          id="pin-nome"
          rotulo="Como quer ser chamado(a)?"
          type="text"
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          placeholder="Seu nome"
          value={nomeInput}
          onChange={(e) => setNomeInput(e.target.value)}
          erro={erroNome}
        />
        <div className="grid grid-cols-2 gap-3">
          <CampoTexto
            id="pin-1"
            rotulo="PIN (4 a 6 números)"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            maxLength={6}
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            erro={erroPin}
          />
          <CampoTexto
            id="pin-2"
            rotulo="Repita o PIN"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={6}
            placeholder="••••"
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
            erro={erroPin2}
          />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={pedirSempre}
          onClick={() => setPedirSempre((v) => !v)}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#1c3a40] bg-white/[0.03] px-4 py-2.5 text-left"
        >
          <span className="flex-1">
            <span className="block text-base font-medium text-white">Pedir o PIN ao abrir</span>
            <span className="block text-sm text-[#8fa9a2]">Depois de 1 hora sem usar</span>
          </span>
          <span aria-hidden className={"relative h-7 w-12 shrink-0 rounded-full transition " + (pedirSempre ? "bg-[#3ee0a8]" : "bg-[#3a5a60]")}>
            <span className={"absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all " + (pedirSempre ? "left-[22px]" : "left-0.5")} />
          </span>
        </button>
        <BotaoEnviar carregando={carregando} textoCarregando="Preparando…">
          Começar
        </BotaoEnviar>
        <p className="text-center text-sm text-[#8fa9a2]">O PIN fica guardado só neste aparelho.</p>
      </form>
    </LayoutAuth>
  );
}
