import React, { useState, useRef } from "react";
import { Loader2, Camera, Mic, Square } from "lucide-react";
import { supabase } from "../supabaseClient";

/* ============================================================
   CAPTURA POR IA (áudio + foto de comprovante)
   ============================================================ */

// Comprime e redimensiona a imagem antes de enviar/guardar (economia de espaço)
export function comprimirImagem(file, maxLado = 1280, q = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const escala = Math.min(1, maxLado / Math.max(width, height));
        width = Math.round(width * escala);
        height = Math.round(height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", q);
        resolve({ dataUrl, base64: dataUrl.split(",")[1] });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Dois botões: 🎙️ Áudio e 📷 Comprovante. Chamam a IA e devolvem o
// lançamento pronto (via onResultado) pra pessoa conferir e salvar.
export function CapturaIA({ onResultado, showToast, compacto = false }) {
  const [estado, setEstado] = useState("idle"); // idle | gravando | processando
  const fotoRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  async function chamarIA(payload, extra = {}) {
    setEstado("processando");
    try {
      const { data, error } = await supabase.functions.invoke("processar", { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.erro || "falhou");
      onResultado({ ...data, ...extra });
    } catch {
      showToast("A IA não conseguiu ler. Pode tentar de novo?", true);
    } finally {
      setEstado("idle");
    }
  }

  async function aoEscolherFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setEstado("processando");
      const { dataUrl, base64 } = await comprimirImagem(file);
      await chamarIA({ kind: "foto", base64, mime: "image/jpeg" }, { comprovante: dataUrl });
    } catch {
      setEstado("idle");
      showToast("Não consegui abrir essa imagem.", true);
    }
  }

  async function gravarAudio() {
    if (estado === "processando") return;
    if (estado === "gravando") {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => ev.data.size > 0 && chunksRef.current.push(ev.data);
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const base64 = await blobParaBase64(blob);
        await chamarIA({ kind: "audio", base64, mime: rec.mimeType || "audio/webm" });
      };
      recRef.current = rec;
      rec.start();
      setEstado("gravando");
    } catch {
      showToast("Não consegui acessar o microfone. Permita o acesso e tente de novo.", true);
    }
  }

  const ocupado = estado === "processando";

  return (
    <>
      <input
        ref={fotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={aoEscolherFoto}
      />
      {ocupado ? (
        <span
          role="status"
          className="flex h-11 items-center gap-1.5 rounded-xl border border-emerald-200 px-3 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
        >
          <Loader2 size={16} className="animate-spin" /> {compacto ? "Lendo…" : "Lendo com IA…"}
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={gravarAudio}
            aria-label={estado === "gravando" ? "Parar gravação" : "Lançar por áudio"}
            title={estado === "gravando" ? "Parar gravação" : "Lançar por áudio"}
            className={
              "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition active:scale-95 " +
              (estado === "gravando"
                ? "border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")
            }
          >
            {estado === "gravando" ? <Square size={16} /> : <Mic size={16} />}
            {!compacto && (estado === "gravando" ? "Parar" : "Áudio")}
          </button>
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            aria-label="Ler foto do comprovante"
            title="Ler foto do comprovante"
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Camera size={16} />
            {!compacto && "Comprovante"}
          </button>
        </>
      )}
    </>
  );
}
