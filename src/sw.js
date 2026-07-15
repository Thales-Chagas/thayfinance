// ============================================================
//  Service worker do Thayfinance (PWA)
//  - Precache dos arquivos do app (mesmo comportamento de antes,
//    que o vite-plugin-pwa gerava sozinho)
//  - Recebe notificações push (contas a vencer + lembrete de anotar)
// ============================================================
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// navegação (URLs do app) cai no index.html precacheado — app abre offline
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// chegou um push do servidor → mostra a notificação
self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { corpo: event.data ? event.data.text() : "" };
  }
  const titulo = dados.titulo || "Thayfinance";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.corpo || "",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      tag: dados.tag || undefined, // mesma tag substitui a anterior (não acumula)
      data: { url: dados.url || "/" },
    })
  );
});

// tocou na notificação → foca o app aberto ou abre uma janela nova
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((janelas) => {
        for (const j of janelas) {
          if ("focus" in j) return j.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
