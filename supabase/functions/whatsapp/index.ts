// ============================================================
//  Thayfinance — Webhook do WhatsApp (o "cérebro")
//  Recebe foto/áudio do robô (Meta Cloud API), chama a IA e grava
//  o lançamento na conta da pessoa certa.
//
//  FLUXO:
//   - FOTO  : baixa a imagem -> guarda no cofre -> Claude (visão) lê
//             valor/data/estabelecimento/categoria -> grava comprovante+transação
//   - ÁUDIO : baixa o áudio  -> Whisper transcreve -> Claude monta o
//             lançamento -> grava transação
//   - Sempre responde no WhatsApp com o resumo do que foi lançado.
//
//  Segredos esperados (configurados no Supabase, nunca no código):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   ANTHROPIC_API_KEY, OPENAI_API_KEY,
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!;
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;

const GRAPH = "https://graph.facebook.com/v21.0";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

// ------------------------------------------------------------
// Util: responde mensagem de texto no WhatsApp
// ------------------------------------------------------------
async function responderWhatsapp(para: string, texto: string) {
  const r = await fetch(`${GRAPH}/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { body: texto },
    }),
  });
  const body = await r.text();
  console.log(`resposta WhatsApp status=${r.status} body=${body}`);
}

// ------------------------------------------------------------
// Util: baixa uma mídia do WhatsApp pelo media_id -> bytes
// ------------------------------------------------------------
async function baixarMidia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string }> {
  // 1) pega a URL temporária da mídia
  const metaResp = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
  });
  const meta = await metaResp.json();
  // 2) baixa o arquivo em si
  const fileResp = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
  });
  const buf = new Uint8Array(await fileResp.arrayBuffer());
  return { bytes: buf, mime: meta.mime_type || "application/octet-stream" };
}

// ------------------------------------------------------------
// Acha o usuário dono do número de WhatsApp
// ------------------------------------------------------------
async function acharUsuario(telefone: string): Promise<string | null> {
  // o Meta manda sem o "+"; normalizamos pra E.164
  const e164 = telefone.startsWith("+") ? telefone : `+${telefone}`;
  const { data } = await db
    .from("phone_links")
    .select("user_id, verificado_em")
    .eq("telefone", e164)
    .maybeSingle();
  if (data?.verificado_em) return data.user_id;
  return null;
}

// ------------------------------------------------------------
// IA: Claude lê a imagem do comprovante e devolve JSON
// ------------------------------------------------------------
async function lerComprovante(base64: string, mime: string) {
  const prompt = `Você é um assistente financeiro. Analise este comprovante (cupom, nota, recibo ou Pix) e extraia os dados.
Responda APENAS um JSON válido, sem texto antes ou depois, no formato exato:
{"valor": number, "data": "YYYY-MM-DD", "estabelecimento": string, "categoria": string, "tipo": "despesa"|"receita"}
Regras: valor é o total pago (número com ponto decimal). Se não achar a data, use null. categoria é uma palavra simples (ex: Mercado, Farmácia, Transporte, Alimentação). Quase sempre é "despesa".`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  const out = await resp.json();
  const texto = out?.content?.[0]?.text ?? "{}";
  return parseJsonSeguro(texto);
}

// ------------------------------------------------------------
// IA: Whisper transcreve o áudio -> texto
// ------------------------------------------------------------
async function transcreverAudio(bytes: Uint8Array, mime: string): Promise<string> {
  const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : "m4a";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "pt");
  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  const out = await resp.json();
  return out?.text ?? "";
}

// ------------------------------------------------------------
// IA: Claude transforma a frase falada em lançamento (JSON)
// ------------------------------------------------------------
async function frasaParaLancamento(frase: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  const prompt = `Hoje é ${hoje}. A pessoa falou sobre um gasto ou ganho. Transforme em lançamento.
Frase: "${frase}"
Responda APENAS um JSON válido no formato:
{"valor": number, "data": "YYYY-MM-DD", "descricao": string, "categoria": string, "tipo": "despesa"|"receita"}
Regras: interprete "ontem", "hoje", "anteontem" em relação a ${hoje}. valor é número com ponto decimal. categoria é uma palavra simples.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const out = await resp.json();
  const texto = out?.content?.[0]?.text ?? "{}";
  return parseJsonSeguro(texto);
}

// converte bytes -> base64 em pedaços (evita estourar a pilha com fotos grandes)
function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000; // 32 KB por vez
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function parseJsonSeguro(s: string): any {
  try {
    const limpo = s.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(limpo);
  } catch {
    return {};
  }
}

// ------------------------------------------------------------
// Acha (ou cria) a categoria pelo nome, no modo pessoal
// ------------------------------------------------------------
async function acharCategoria(userId: string, nome: string): Promise<string | null> {
  if (!nome) return null;
  const { data: existente } = await db
    .from("categorias")
    .select("id")
    .eq("user_id", userId)
    .eq("modo", "pessoal")
    .ilike("nome", nome)
    .maybeSingle();
  if (existente) return existente.id;
  const { data: nova } = await db
    .from("categorias")
    .insert({ user_id: userId, modo: "pessoal", nome })
    .select("id")
    .single();
  return nova?.id ?? null;
}

function fmtBR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ---- Verificação do webhook (Meta chama isso 1x ao configurar) ----
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("ok", { status: 200 });

  // ---- Mensagem recebida ----
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  // responde 200 rápido pro Meta não reenviar; processa em seguida
  const processar = async () => {
    try {
      const value = payload?.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];
      if (!msg) {
        const statuses = value?.statuses;
        if (statuses) console.log("status de entrega:", JSON.stringify(statuses));
        else console.log("sem mensagem, ignorando");
        return;
      }

      const de = msg.from as string; // número de quem mandou (sem +)
      console.log(`mensagem recebida de ${de}, tipo=${msg.type}`);
      const userId = await acharUsuario(de);
      console.log(`usuário encontrado: ${userId ?? "NENHUM"}`);
      if (!userId) {
        await responderWhatsapp(
          de,
          "Olá! Este número ainda não está vinculado a uma conta Thayfinance. Abra o app e vincule seu WhatsApp para começar. 😊",
        );
        return;
      }

      // ---------- FOTO (comprovante) ----------
      if (msg.type === "image") {
        console.log("baixando imagem...");
        const { bytes, mime } = await baixarMidia(msg.image.id);
        console.log(`imagem baixada: ${bytes.length} bytes, ${mime}`);
        const caminho = `${userId}/${crypto.randomUUID()}.jpg`;
        await db.storage.from("comprovantes").upload(caminho, bytes, {
          contentType: mime,
          upsert: false,
        });

        const base64 = bytesParaBase64(bytes);
        console.log("chamando Claude (visão)...");
        const dados = await lerComprovante(base64, mime);
        console.log("Claude respondeu:", JSON.stringify(dados));

        const catId = await acharCategoria(userId, dados.categoria);
        console.log(`categoria_id: ${catId}`);
        const { data: tx, error: txErr } = await db
          .from("transacoes")
          .insert({
            user_id: userId,
            modo: "pessoal",
            tipo: dados.tipo || "despesa",
            status: "ok",
            data: dados.data || new Date().toISOString().slice(0, 10),
            valor: dados.valor || 0,
            descricao: dados.estabelecimento || "Comprovante",
            origem: "whatsapp",
            categoria_id: catId,
          })
          .select("id")
          .single();
        if (txErr) console.error("erro ao gravar transação:", JSON.stringify(txErr));
        else console.log(`transação gravada: ${tx?.id}`);

        const { error: compErr } = await db.from("comprovantes").insert({
          user_id: userId,
          transacao_id: tx?.id ?? null,
          storage_path: caminho,
          mime_type: mime,
          tamanho_bytes: bytes.length,
          origem: "whatsapp",
          ocr_status: "concluido",
          ocr_bruto: dados,
          extraido_valor: dados.valor ?? null,
          extraido_data: dados.data ?? null,
          extraido_estabelecimento: dados.estabelecimento ?? null,
          extraido_categoria: dados.categoria ?? null,
        });
        if (compErr) console.error("erro ao gravar comprovante:", JSON.stringify(compErr));

        await responderWhatsapp(
          de,
          `✅ Comprovante lançado!\n\n💸 ${fmtBR(dados.valor || 0)}\n🏷️ ${dados.categoria || "—"}\n🏪 ${dados.estabelecimento || "—"}\n📅 ${dados.data || "hoje"}\n\nA foto ficou guardada na sua conta. Se algo estiver errado, é só corrigir no app.`,
        );
        return;
      }

      // ---------- ÁUDIO ----------
      if (msg.type === "audio") {
        const { bytes, mime } = await baixarMidia(msg.audio.id);
        const frase = await transcreverAudio(bytes, mime);
        if (!frase) {
          await responderWhatsapp(de, "Não consegui entender o áudio. Pode tentar de novo? 🎙️");
          return;
        }
        const dados = await frasaParaLancamento(frase);
        const catId = await acharCategoria(userId, dados.categoria);
        await db.from("transacoes").insert({
          user_id: userId,
          modo: "pessoal",
          tipo: dados.tipo || "despesa",
          status: "ok",
          data: dados.data || new Date().toISOString().slice(0, 10),
          valor: dados.valor || 0,
          descricao: dados.descricao || frase,
          origem: "audio",
          categoria_id: catId,
        });

        await responderWhatsapp(
          de,
          `✅ Lançado por áudio!\n\n💸 ${fmtBR(dados.valor || 0)}\n🏷️ ${dados.categoria || "—"}\n📝 ${dados.descricao || frase}\n📅 ${dados.data || "hoje"}\n\nSe algo estiver errado, é só corrigir no app.`,
        );
        return;
      }

      // ---------- Qualquer outra coisa ----------
      await responderWhatsapp(
        de,
        "Oi! 👋 Me mande a *foto de um comprovante* ou um *áudio* contando o gasto, que eu lanço pra você.",
      );
    } catch (e) {
      console.error("erro ao processar:", e);
    }
  };

  // mantém o processo vivo até terminar (download + IA + resposta),
  // mas já devolve 200 rápido pro Meta não reenviar
  EdgeRuntime.waitUntil(processar());
  return new Response("ok", { status: 200 });
});
