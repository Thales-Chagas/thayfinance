import React, { useState, useRef } from "react";
import logoUrl from "../logo.webp";
import emblemaUrl from "../emblema.webp";
import { Moon, Sun, Camera, ScanFace } from "lucide-react";
import { inputCls } from "../components/ui";
import { CropFotoModal } from "../components/CropFotoModal";

/* ============================================================
   TELA DE LOGIN (primeiro uso + bloqueio opcional por PIN)
   ============================================================ */

export function CampoLogin({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <input {...props} className={inputCls} />
    </div>
  );
}

export function TelaLogin({ modo, nome, foto, onCriar, onDesbloquear, onEsqueci, onBiometria, temBio, escuro, onTema }) {
  const [nomeInput, setNomeInput] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pedirSempre, setPedirSempre] = useState(true);
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [fotoNova, setFotoNova] = useState(null);
  const [arquivoCrop, setArquivoCrop] = useState(null);
  const fotoRef = useRef(null);

  const pinValido = (p) => /^\d{4,6}$/.test(p);

  async function criar(e) {
    e.preventDefault();
    if (!nomeInput.trim()) return setErro("Digite como você quer ser chamada.");
    if (!pinValido(pin)) return setErro("O PIN precisa ter de 4 a 6 números.");
    if (pin !== pin2) return setErro("Os dois PINs não são iguais. Tente de novo.");
    setErro("");
    await onCriar(nomeInput.trim(), pin, pedirSempre, fotoNova);
  }

  async function desbloquear(e) {
    e.preventDefault();
    if (!pinValido(pin)) return setErro("Digite o PIN (4 a 6 números).");
    setVerificando(true);
    const ok = await onDesbloquear(pin);
    setVerificando(false);
    if (!ok) {
      setPin("");
      setErro("PIN incorreto. Tente de novo.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <button
        onClick={onTema}
        aria-label="Alternar modo claro/escuro"
        className="fixed right-4 top-4 rounded-full border border-slate-200 bg-white p-2.5 text-slate-500 dark:text-slate-400 transition hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:text-slate-300"
      >
        {escuro ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-6 flex flex-col items-center text-center">
          {modo === "lock" && foto ? (
            <img src={foto} alt="" className="mb-3 h-20 w-20 rounded-full border-2 border-emerald-500 object-cover" />
          ) : modo === "lock" ? (
            <img src={emblemaUrl} alt="" className="mb-3 h-20 w-20 object-contain" />
          ) : (
            <div className="mb-2 rounded-2xl bg-white px-4 py-2">
              <img src={logoUrl} alt="" className="h-28 object-contain" />
            </div>
          )}
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {modo === "lock" ? `Olá, ${nome}!` : "Bem-vinda ao Thayfinance"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {modo === "lock" ? "Digite seu PIN para entrar" : "Vamos preparar seu app em 10 segundos"}
          </p>
        </div>

        {modo === "setup" ? (
          <form onSubmit={criar} className="space-y-4">
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
            <div className="flex flex-col items-center gap-1.5">
              <button type="button" onClick={() => fotoRef.current?.click()} aria-label="Escolher foto" className="transition hover:opacity-80">
                {fotoNova ? (
                  <img src={fotoNova} alt="" className="h-20 w-20 rounded-full border-2 border-emerald-500 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-500 dark:text-slate-400 dark:border-slate-600">
                    <Camera size={24} />
                  </div>
                )}
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">Foto (opcional) — toque para escolher</span>
            </div>
            <CampoLogin
              label="Como você quer ser chamada?"
              type="text"
              value={nomeInput}
              onChange={(e) => setNomeInput(e.target.value)}
              placeholder="Seu nome"
            />
            <CampoLogin
              label="Crie um PIN (4 a 6 números)"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
            />
            <CampoLogin
              label="Repita o PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
            />
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={pedirSempre}
                onChange={(e) => setPedirSempre(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              Proteger com PIN (pede a cada 1 hora)
            </label>
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            <button type="submit" className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
              Começar
            </button>
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">O PIN fica guardado só neste aparelho.</p>
          </form>
        ) : (
          <form onSubmit={desbloquear} className="space-y-4">
            {temBio && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    setErro("");
                    const ok = await onBiometria();
                    if (!ok) setErro("Não reconheci. Você pode entrar com o PIN abaixo.");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <ScanFace size={18} /> Entrar com Face ID / digital
                </button>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  ou use o PIN
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>
              </>
            )}
            <CampoLogin
              label="Seu PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              autoFocus={!temBio}
            />
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            <button
              type="submit"
              disabled={verificando}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {verificando ? "Verificando..." : "Entrar"}
            </button>
            <button type="button" onClick={onEsqueci} className="w-full text-center text-xs text-slate-500 dark:text-slate-400 underline-offset-2 hover:underline">
              Esqueci o PIN
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
