import React, { useState, useRef } from "react";
import { Loader2, Camera, Mic, Square } from "lucide-react";
import { supabase } from "../supabaseClient";
import { BotaoLeve } from "./ui";

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
export function CapturaIA({ onResultado, showToast }) {
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
        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:border-emerald-800 dark:text-emerald-400">
          <Loader2 size={14} className="animate-spin" /> lendo com IA…
        </span>
      ) : (
        <>
          <BotaoLeve
            onClick={gravarAudio}
            title="Lançar por áudio"
            className={estado === "gravando" ? "!border-red-300 !bg-red-50 !text-red-600 dark:!bg-red-950" : ""}
          >
            {estado === "gravando" ? <><Square size={14} /> Parar</> : <><Mic size={14} /> Áudio</>}
          </BotaoLeve>
          <BotaoLeve onClick={() => fotoRef.current?.click()} title="Ler comprovante">
            <Camera size={14} /> Comprovante
          </BotaoLeve>
        </>
      )}
    </>
  );
}
