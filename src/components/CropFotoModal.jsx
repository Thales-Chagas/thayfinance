import React, { useState, useEffect, useRef } from "react";
import { Check, Loader2 } from "lucide-react";
import { BotaoPrimario, Modal } from "./ui";

// Tela de ajuste de foto: arrastar + zoom dentro de um círculo antes de salvar
export function CropFotoModal({ file, onConfirmar, onFechar }) {
  const F = 256; // tamanho do quadro de recorte (px)
  const [url, setUrl] = useState(null); // imagem como data URL (sobrevive ao StrictMode)
  const [nat, setNat] = useState(null); // dimensões naturais da imagem
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [erro, setErro] = useState(false);
  const drag = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setUrl(reader.result);
    reader.onerror = () => setErro(true);
    reader.readAsDataURL(file);
  }, [file]);

  const base = nat ? F / Math.min(nat.w, nat.h) : 1; // "cobrir" o quadro no zoom 1
  const dispW = nat ? nat.w * base * zoom : F;
  const dispH = nat ? nat.h * base * zoom : F;

  const limitar = (o) => ({
    x: Math.min(0, Math.max(F - dispW, o.x)),
    y: Math.min(0, Math.max(F - dispH, o.y)),
  });

  function aoCarregar(e) {
    const w = e.target.naturalWidth, h = e.target.naturalHeight;
    setNat({ w, h });
    const b = F / Math.min(w, h);
    setOff({ x: (F - w * b) / 2, y: (F - h * b) / 2 }); // centraliza
  }

  useEffect(() => {
    setOff((o) => limitar(o));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, nat]);

  function descer(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  }
  function mover(e) {
    if (!drag.current) return;
    setOff(
      limitar({
        x: drag.current.ox + (e.clientX - drag.current.x),
        y: drag.current.oy + (e.clientY - drag.current.y),
      })
    );
  }
  function soltar() {
    drag.current = null;
  }

  function confirmar() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = F;
      const ctx = canvas.getContext("2d");
      const s = base * zoom;
      ctx.drawImage(imgRef.current, -off.x / s, -off.y / s, F / s, F / s, 0, 0, F, F);
      onConfirmar(canvas.toDataURL("image/jpeg", 0.85));
    } catch {
      setErro(true);
    }
  }

  return (
    <Modal titulo="Ajustar foto" onFechar={onFechar}>
      <div className="space-y-4">
        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-full border-2 border-emerald-500 bg-slate-100 dark:bg-slate-800"
          style={{ width: F, height: F, maxWidth: "100%" }}
          onPointerDown={descer}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          {url ? (
            <img
              ref={imgRef}
              src={url}
              alt=""
              onLoad={aoCarregar}
              onError={() => setErro(true)}
              draggable={false}
              style={{
                position: "absolute",
                left: off.x,
                top: off.y,
                width: dispW,
                height: dispH,
                maxWidth: "none",
                cursor: "grab",
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-emerald-600"
          />
        </div>
        <p className="text-center text-xs text-slate-400">
          Arraste a foto para enquadrar e use o zoom. O círculo mostra o que vai aparecer.
        </p>
        {erro && (
          <p className="text-center text-sm text-red-600 dark:text-red-400">
            Não foi possível abrir essa imagem. Tente outra.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <BotaoPrimario onClick={confirmar} className="flex-1 justify-center">
            <Check size={16} /> Usar foto
          </BotaoPrimario>
        </div>
      </div>
    </Modal>
  );
}
