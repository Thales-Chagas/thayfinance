// Instalação como aplicativo (PWA). O Chrome no Android/PC dispara
// beforeinstallprompt bem antes do React montar — por isso este módulo é
// carregado logo na abertura (o Tour, que usa o evento, vem sob demanda).
// No iPhone esse evento não existe: lá a instalação é sempre manual
// (Compartilhar → Adicionar à Tela de Início).
export const instalacao = { evento: null };
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    instalacao.evento = e;
  });
  window.addEventListener("appinstalled", () => {
    instalacao.evento = null;
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
    return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

// Cor da barra de status do celular acompanha o tema do app
export function aplicarCorDoTema(escuro) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", escuro ? "#020617" : "#f8fafc");
}
