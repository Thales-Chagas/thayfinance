// ============================================================
//  Thayfinance — Notificações push no celular (Web Push)
//  Roda por agendamento (pg_cron) e envia notificação pros aparelhos
//  que ativaram em Conta > Notificações (tabela push_subscriptions).
//
//  Tipos (query ?tipo=):
//    contas   — diário: contas pendentes vencidas ou vencendo em até 3 dias
//    lembrete — a cada 5 dias: lembra de anotar os gastos (pula quem
//               lançou algo nos últimos 2 dias — já está anotando)
//    teste    — envia "🔔 Teste" pra todos os aparelhos (depuração)
//
//  Segurança: só roda com o header X-Notify-Secret correto (NOTIFY_SECRET).
//             O agendador (pg_cron) envia esse header. Sem ele = 401.
//  Segredos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NOTIFY_SECRET,
//            VAPID_KEYS (par de chaves JWK gerado uma única vez)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.3.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTIFY_SECRET = Deno.env.get("NOTIFY_SECRET")!;

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

// Inicialização preguiçosa: se algo aqui falhar, o erro aparece na resposta
// da requisição (500 com log) em vez de derrubar a função inteira no boot.
// O secret VAPID_KEYS vem em base64 (JSON puro dentro) pra não sofrer com aspas.
let appServerPromise: Promise<webpush.ApplicationServer> | null = null;
function getAppServer() {
  appServerPromise ??= (async () => {
    const bruto = (Deno.env.get("VAPID_KEYS") ?? "").trim();
    const json = bruto.startsWith("{")
      ? bruto
      : new TextDecoder().decode(Uint8Array.from(atob(bruto), (c) => c.charCodeAt(0)));
    const vapidKeys = await webpush.importVapidKeys(JSON.parse(json), {
      extractable: false,
    });
    return await webpush.ApplicationServer.new({
      contactInformation: "mailto:thalesregyss@gmail.com",
      vapidKeys,
    });
  })();
  return appServerPromise;
}

// ---- datas no fuso do Brasil (o servidor roda em UTC) ----
const hojeSP = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const somarDias = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dinheiro = (v: number) =>
  "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

// ---- envio de 1 push; limpa assinaturas mortas (aparelho desinstalou etc.) ----
async function enviar(sub: any, payload: any): Promise<"ok" | "removida" | "erro"> {
  try {
    const appServer = await getAppServer();
    const subscriber = appServer.subscribe({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    });
    await subscriber.pushTextMessage(JSON.stringify(payload), {});
    return "ok";
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 404 || status === 410) {
      await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      return "removida";
    }
    console.error("push falhou:", status ?? String(e).slice(0, 200));
    return "erro";
  }
}

// ---- monta a notificação de contas de UM usuário (ou null se não tem nada) ----
function montarContas(pendentes: any[], hoje: string) {
  if (!pendentes.length) return null;
  const vencidas = pendentes.filter((t) => t.data < hoje);
  const doDia = pendentes.filter((t) => t.data === hoje);

  let titulo: string;
  if (doDia.length) {
    titulo = doDia.length === 1 ? "⏰ 1 conta vence hoje" : `⏰ ${doDia.length} contas vencem hoje`;
  } else if (vencidas.length) {
    titulo = vencidas.length === 1 ? "🔴 1 conta vencida" : `🔴 ${vencidas.length} contas vencidas`;
  } else {
    titulo = "📅 Contas chegando no vencimento";
  }

  const linha = (t: any) => {
    const nome = (t.descricao || "").trim() || (t.tipo === "receita" ? "A receber" : "Conta");
    const quando = t.data < hoje
      ? `venceu ${dataBR(t.data)}`
      : t.data === hoje
        ? "vence HOJE"
        : `vence ${dataBR(t.data)}`;
    const sinal = t.tipo === "receita" ? "receber" : "pagar";
    return `• ${nome} — ${dinheiro(t.valor)} (${sinal}, ${quando})`;
  };
  const linhas = pendentes.slice(0, 4).map(linha);
  if (pendentes.length > 4) linhas.push(`… e mais ${pendentes.length - 4}`);

  return { titulo, corpo: linhas.join("\n"), tag: "contas", url: "/" };
}

async function rodar(tipo: string) {
  const { data: subs, error } = await db.from("push_subscriptions").select("*");
  if (error) throw error;
  if (!subs?.length) return { assinaturas: 0, enviadas: 0, removidas: 0 };

  // agrupa os aparelhos por usuário
  const porUser = new Map<string, any[]>();
  for (const s of subs) {
    if (!porUser.has(s.user_id)) porUser.set(s.user_id, []);
    porUser.get(s.user_id)!.push(s);
  }

  let enviadas = 0, removidas = 0;

  for (const [userId, aparelhos] of porUser) {
    let payload: any = null;

    if (tipo === "contas") {
      const hoje = hojeSP();
      const { data: pend } = await db
        .from("transacoes")
        .select("tipo,data,valor,descricao")
        .eq("user_id", userId)
        .eq("status", "pendente")
        .lte("data", somarDias(hoje, 3))
        .order("data")
        .limit(50);
      payload = montarContas(pend || [], hoje);
    } else if (tipo === "lembrete") {
      // quem lançou algo nos últimos 2 dias já está anotando — não perturba
      const corte = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentes } = await db
        .from("transacoes")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", corte)
        .limit(1);
      if (!recentes?.length) {
        payload = {
          titulo: "📝 Bora anotar os gastos?",
          corpo:
            "Já faz uns dias sem lançamentos. Anotar agora evita esquecer depois — vale áudio ou foto do comprovante! 💚",
          tag: "lembrete",
          url: "/",
        };
      }
    } else if (tipo === "teste") {
      payload = {
        titulo: "🔔 Teste do Thayfinance",
        corpo: "As notificações estão funcionando neste aparelho. 🎉",
        tag: "teste",
        url: "/",
      };
    }

    if (!payload) continue;
    for (const sub of aparelhos) {
      const r = await enviar(sub, payload);
      if (r === "ok") enviadas++;
      if (r === "removida") removidas++;
    }
  }

  return { assinaturas: subs.length, enviadas, removidas };
}

// ============================================================
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  if (req.headers.get("X-Notify-Secret") !== NOTIFY_SECRET) {
    return new Response("forbidden", { status: 401 });
  }
  const tipo = new URL(req.url).searchParams.get("tipo") || "contas";
  if (!["contas", "lembrete", "teste"].includes(tipo)) {
    return new Response(JSON.stringify({ ok: false, erro: "tipo inválido" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await getAppServer(); // valida as chaves VAPID logo — erro claro no log
    const resultado = await rodar(tipo);
    console.log(`notificar(${tipo}):`, JSON.stringify(resultado));
    return new Response(JSON.stringify({ ok: true, tipo, ...resultado }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("erro ao notificar:", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
