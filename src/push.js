// ============================================================
//  Notificações push no celular (Web Push)
//  O navegador cria uma "assinatura" única deste aparelho, que fica
//  guardada em push_subscriptions (RLS: cada um só vê a própria).
//  A Edge Function `notificar` usa essas assinaturas pra enviar:
//  contas a vencer (diário) e lembrete de anotar gastos (a cada 5 dias).
// ============================================================
import { supabase } from "./supabaseClient";

// Chave PÚBLICA do servidor de push (VAPID) — não é segredo.
// A privada correspondente vive só nos secrets do Supabase.
const VAPID_PUBLIC_KEY =
  "BDrr3qE6H5iFXENcCtXFpT4f1WwAMCKiIzn4W4zBm1mHkBcKJ5FbsHYWx6H2jR4HTYtVjHYi116bCz77sHwNxCo";

const b64UrlParaBytes = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const ehIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent || "");
const rodandoInstalado = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator.standalone === true;

// O que este aparelho consegue fazer:
//  "ok" | "ios-precisa-instalar" | "bloqueado" | "sem-suporte"
export function suportePush() {
  if (
    !("serviceWorker" in navigator) ||
    !("Notification" in window) ||
    !("PushManager" in window)
  ) {
    // iPhone sem o app instalado nem expõe PushManager — orienta a instalar
    if (ehIos() && !rodandoInstalado()) return "ios-precisa-instalar";
    return "sem-suporte";
  }
  if (ehIos() && !rodandoInstalado()) return "ios-precisa-instalar";
  if (Notification.permission === "denied") return "bloqueado";
  return "ok";
}

// Assinatura deste aparelho, se já existir (null se não)
export async function assinaturaAtual() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg?.pushManager) return null;
  return await reg.pushManager.getSubscription();
}

// Liga as notificações neste aparelho (pede permissão) e guarda na nuvem
export async function ativarPush(userId) {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    throw new Error("Permissão negada. Libere as notificações nas configurações do navegador.");
  }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    throw new Error("O app ainda está terminando de carregar — tente de novo em instantes.");
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64UrlParaBytes(VAPID_PUBLIC_KEY),
  });
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      user_id: userId,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      aparelho: (navigator.userAgent || "").slice(0, 200),
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    await sub.unsubscribe().catch(() => {});
    throw new Error("Não consegui guardar a assinatura: " + error.message);
  }
  return sub;
}

// Desliga neste aparelho: apaga da nuvem e cancela no navegador
export async function desativarPush() {
  const sub = await assinaturaAtual();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}
