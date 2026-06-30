// ============================================================
//  Thayfinance — Bot do Telegram (entrada por áudio/foto/texto)
//  Substitui o robô do WhatsApp (que exigia verificação de empresa).
//
//  Defesas (ver plano de segurança):
//   - valida o header secret do webhook (X-Telegram-Bot-Api-Secret-Token)
//   - allowlist: só chat_ids cadastrados em telegram_links são atendidos
//   - rate limit por chat_id
//   - valida o JSON do modelo contra um schema rígido antes de gravar
//   - o modelo NUNCA decide tabela nem gera SQL; só preenche campos validados
//
//  Segredos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
//            OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_SECRET")!;

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

// rate limit simples por chat_id (na memória do isolate)
const ACESSOS = new Map<number, number[]>();
const LIMITE = 12; // mensagens
const JANELA = 60_000; // por 60s
function dentroDoLimite(chatId: number): boolean {
  const agora = Date.now();
  const lista = (ACESSOS.get(chatId) || []).filter((t) => agora - t < JANELA);
  lista.push(agora);
  ACESSOS.set(chatId, lista);
  return lista.length <= LIMITE;
}

// ------------------------------------------------------------
async function responder(chatId: number, texto: string) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
}

async function baixarArquivo(fileId: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const r = await fetch(`${API}/getFile?file_id=${fileId}`);
  const j = await r.json();
  const path = j?.result?.file_path;
  if (!path) throw new Error("getFile falhou");
  const f = await fetch(`${FILE_API}/${path}`);
  const bytes = new Uint8Array(await f.arrayBuffer());
  const mime = path.endsWith(".oga") || path.endsWith(".ogg")
    ? "audio/ogg"
    : path.endsWith(".mp3") ? "audio/mpeg"
    : path.endsWith(".m4a") ? "audio/m4a"
    : path.endsWith(".png") ? "image/png"
    : "image/jpeg";
  return { bytes, mime };
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function parseJsonSeguro(s: string): any {
  try {
    return JSON.parse(s.replace(/```json/gi, "").replace(/```/g, "").trim());
  } catch {
    return {};
  }
}

// ------------------------------------------------------------
// Validação rígida da saída do modelo (dados NÃO confiáveis)
// ------------------------------------------------------------
function validarLancamento(d: any) {
  const valor = Number(d?.valor);
  if (!isFinite(valor) || valor <= 0 || valor > 1_000_000) return null;
  const tipo = d?.tipo === "receita" ? "receita" : "despesa";
  let data: string | null =
    typeof d?.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.data) ? d.data : null;
  if (data && isNaN(new Date(data + "T00:00:00").getTime())) data = null;
  if (!data) data = new Date().toISOString().slice(0, 10);
  const txt = (v: any, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : null);
  return {
    valor: Math.round(valor * 100) / 100,
    tipo,
    data,
    categoria: txt(d?.categoria, 40),
    estabelecimento: txt(d?.estabelecimento, 120),
    descricao: txt(d?.descricao, 200),
  };
}

// ---- IA: comprovante (visão) ----
async function lerComprovante(base64: string, mime: string) {
  const prompt = `Você é um assistente financeiro brasileiro. Analise este comprovante e extraia os dados.
Responda APENAS um JSON válido:
{"valor": number, "data": "YYYY-MM-DD", "estabelecimento": string, "categoria": string, "tipo": "despesa"|"receita"}
Regras:
- VALOR: o TOTAL da compra ("VALOR TOTAL"/"TOTAL A PAGAR"). NUNCA o "TROCO" nem o "DINHEIRO"/"VALOR RECEBIDO".
- DATA: use a DATA DE EMISSÃO ("Emissão"/"Emitido em"), formato BR DD/MM/AAAA → converta p/ YYYY-MM-DD sem inverter dia e mês.
- ESTABELECIMENTO: a razão social da primeira linha do topo, nome completo (ex: "Silva e Barbosa Comercio de Alimentos LTDA").
- categoria simples (ex: Mercado, Farmácia, Transporte).`;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
        { type: "text", text: prompt },
      ] }],
    }),
  });
  const out = await resp.json();
  return parseJsonSeguro(out?.content?.[0]?.text ?? "{}");
}

// ---- IA: Whisper transcreve ----
async function transcrever(bytes: Uint8Array, mime: string): Promise<string> {
  const ext = mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : "m4a";
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

// ---- IA: frase falada/escrita -> lançamento ----
async function fraseParaLancamento(frase: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  const prompt = `Hoje é ${hoje}. A pessoa falou/escreveu sobre um gasto ou ganho. Transforme em lançamento.
Frase: "${frase}"
Responda APENAS um JSON válido:
{"valor": number, "data": "YYYY-MM-DD", "descricao": string, "categoria": string, "tipo": "despesa"|"receita"}
Regras: interprete "ontem"/"hoje"/"anteontem" em relação a ${hoje}. valor com ponto decimal. categoria simples.`;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
  });
  const out = await resp.json();
  return parseJsonSeguro(out?.content?.[0]?.text ?? "{}");
}

async function acharCategoria(userId: string, nome: string | null): Promise<string | null> {
  if (!nome) return null;
  const { data: existe } = await db.from("categorias")
    .select("id").eq("user_id", userId).eq("modo", "pessoal").ilike("nome", nome).maybeSingle();
  if (existe) return existe.id;
  const { data: nova } = await db.from("categorias")
    .insert({ user_id: userId, modo: "pessoal", nome }).select("id").single();
  return nova?.id ?? null;
}

const fmtBR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function gravarTransacao(userId: string, dados: any) {
  const catId = await acharCategoria(userId, dados.categoria);
  const { data: tx } = await db.from("transacoes").insert({
    user_id: userId, modo: "pessoal", tipo: dados.tipo, status: "ok",
    data: dados.data, valor: dados.valor,
    descricao: dados.descricao || dados.estabelecimento || null,
    origem: "telegram", categoria_id: catId,
  }).select("id").single();
  return tx?.id ?? null;
}

// ============================================================
Deno.serve(async (req) => {
  // Atalho de setup (temporário): registra o webhook usando os segredos
  if (req.method === "GET" && new URL(req.url).searchParams.get("action") === "setwebhook") {
    const url = `${SUPABASE_URL}/functions/v1/telegram`;
    const r = await fetch(`${API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret_token: WEBHOOK_SECRET, allowed_updates: ["message"] }),
    });
    return new Response(await r.text(), { status: 200, headers: { "content-type": "application/json" } });
  }

  // 1) só aceita POST com o secret correto do webhook
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 401 });
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response("ok", { status: 200 }); }

  const processar = async () => {
    try {
      const msg = update?.message;
      if (!msg) return;
      const chatId: number = msg.chat?.id;
      if (!chatId) return;

      // 2) allowlist — chat_id precisa estar cadastrado
      const { data: link } = await db.from("telegram_links")
        .select("user_id").eq("chat_id", chatId).maybeSingle();
      if (!link) {
        console.log(`chat_id nao autorizado: ${chatId} (ignorado)`);
        return; // silêncio: não confirma que o bot existe
      }
      const userId = link.user_id;

      // 3) rate limit
      if (!dentroDoLimite(chatId)) {
        await responder(chatId, "Calma! Muitas mensagens seguidas. Tente de novo em um minutinho. 🙂");
        return;
      }

      // ---- ÁUDIO / VOZ ----
      const voz = msg.voice || msg.audio;
      if (voz?.file_id) {
        if (voz.duration && voz.duration > 120) {
          await responder(chatId, "Esse áudio é longo demais (máx ~2 min). Tente um mais curtinho. 🎙️");
          return;
        }
        const { bytes, mime } = await baixarArquivo(voz.file_id);
        const frase = await transcrever(bytes, mime);
        if (!frase) { await responder(chatId, "Não entendi o áudio. Pode repetir? 🎙️"); return; }
        const dados = validarLancamento(await fraseParaLancamento(frase));
        if (!dados) { await responder(chatId, `Entendi: "${frase}", mas não achei um valor válido. Tente: "gastei 50 no mercado". 🙂`); return; }
        await gravarTransacao(userId, dados);
        await responder(chatId, `✅ Lançado por áudio!\n\n💸 ${fmtBR(dados.valor)}\n🏷️ ${dados.categoria || "—"}\n📝 ${dados.descricao || frase}\n📅 ${dados.data}`);
        return;
      }

      // ---- FOTO / IMAGEM (comprovante) ----
      const foto = (msg.photo && msg.photo[msg.photo.length - 1]) ||
        (msg.document && /^image\//.test(msg.document.mime_type || "") ? msg.document : null);
      if (foto?.file_id) {
        const { bytes, mime } = await baixarArquivo(foto.file_id);
        const caminho = `${userId}/${crypto.randomUUID()}.jpg`;
        await db.storage.from("comprovantes").upload(caminho, bytes, { contentType: mime, upsert: false });
        const dados = validarLancamento(await lerComprovante(bytesParaBase64(bytes), mime));
        if (!dados) { await responder(chatId, "Não consegui ler o valor desse comprovante. 📷 Pode mandar de novo, mais nítido?"); return; }
        const txId = await gravarTransacao(userId, dados);
        await db.from("comprovantes").insert({
          user_id: userId, transacao_id: txId, storage_path: caminho, mime_type: mime,
          tamanho_bytes: bytes.length, origem: "telegram", ocr_status: "concluido",
          ocr_bruto: dados, extraido_valor: dados.valor, extraido_data: dados.data,
          extraido_estabelecimento: dados.estabelecimento, extraido_categoria: dados.categoria,
        });
        await responder(chatId, `✅ Comprovante lançado!\n\n💸 ${fmtBR(dados.valor)}\n🏷️ ${dados.categoria || "—"}\n🏪 ${dados.estabelecimento || "—"}\n📅 ${dados.data}\n\nA foto ficou guardada na sua conta.`);
        return;
      }

      // ---- TEXTO ----
      if (typeof msg.text === "string" && msg.text.trim()) {
        if (msg.text.trim().toLowerCase() === "/start") {
          await responder(chatId, "Oi! 👋 Sou o assistente do Thayfinance. Me mande um *áudio*, uma *foto de comprovante* ou *escreva* o gasto (ex: \"gastei 50 no mercado\") que eu lanço pra você.");
          return;
        }
        const dados = validarLancamento(await fraseParaLancamento(msg.text));
        if (!dados) { await responder(chatId, "Não achei um valor nessa mensagem. Tente algo como: \"gastei 50 no mercado ontem\". 🙂"); return; }
        await gravarTransacao(userId, dados);
        await responder(chatId, `✅ Lançado!\n\n💸 ${fmtBR(dados.valor)}\n🏷️ ${dados.categoria || "—"}\n📝 ${dados.descricao || msg.text}\n📅 ${dados.data}`);
        return;
      }

      await responder(chatId, "Me mande um *áudio*, uma *foto de comprovante* ou *escreva* o gasto que eu lanço. 😊");
    } catch (e) {
      console.error("erro ao processar:", e);
    }
  };

  EdgeRuntime.waitUntil(processar());
  return new Response("ok", { status: 200 });
});
