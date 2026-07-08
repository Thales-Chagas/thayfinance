// ============================================================
//  Thayfinance — "Tradutor de IA" do APP
//  Recebe áudio ou foto do app e devolve o lançamento pronto (JSON).
//  - audio: Whisper transcreve -> Claude monta o lançamento
//  - foto : Claude (visão) lê o comprovante
//  O app mostra o resultado pra pessoa CONFERIR antes de salvar.
//
//  Segredos: ANTHROPIC_API_KEY, OPENAI_API_KEY
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// SUPABASE_URL e SUPABASE_ANON_KEY são injetados automaticamente pela plataforma.
// Este cliente é usado SÓ para validar o usuário logado (getUser) — não lê dados.
const authClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Limite de uso por usuário (anti-abuso de custo de IA). Em memória do isolate:
// não é perfeito num ambiente serverless, mas é uma trava a mais além do login.
const ACESSOS = new Map<string, number[]>();
const LIMITE = 30; // requisições
const JANELA = 60_000; // por 60s
function dentroDoLimite(id: string): boolean {
  const agora = Date.now();
  const lista = (ACESSOS.get(id) || []).filter((t) => agora - t < JANELA);
  lista.push(agora);
  ACESSOS.set(id, lista);
  return lista.length <= LIMITE;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

function parseJsonSeguro(s: string): any {
  try {
    return JSON.parse(s.replace(/```json/gi, "").replace(/```/g, "").trim());
  } catch {
    return {};
  }
}

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---- Claude lê a imagem do comprovante ----
async function lerComprovante(base64: string, mime: string) {
  const prompt = `Você é um assistente financeiro brasileiro. Analise este comprovante (cupom, nota, recibo ou Pix) e extraia os dados.
Responda APENAS um JSON válido, sem texto antes ou depois:
{"valor": number, "data": "YYYY-MM-DD", "estabelecimento": string, "categoria": string, "tipo": "despesa"|"receita"}
Regras:
- VALOR: use o TOTAL DA COMPRA — procure por "VALOR TOTAL", "TOTAL R$", "TOTAL A PAGAR", "VALOR A PAGAR" ou "VALOR COBRADO". NUNCA use o "TROCO" (é o dinheiro que volta) nem o "DINHEIRO"/"VALOR RECEBIDO"/"VALOR PAGO" (é quanto a pessoa entregou, costuma ser maior que o total). Se houver desconto, use o total final já com o desconto aplicado. Número com ponto decimal.
- DATA: use sempre a DATA DE EMISSÃO da nota (procure por "Emissão", "Data de emissão" ou "Emitido em"). O formato é brasileiro DD/MM/AAAA (DIA primeiro, depois o MÊS): "08/05/2026" = 8 de maio de 2026 → "2026-05-08". Cuidado para NÃO inverter dia e mês. Se não achar, use null.
- ESTABELECIMENTO: use o nome no TOPO do comprovante — a razão social da primeira linha, o nome completo como está escrito (ex: "Silva e Barbosa Comercio de Alimentos LTDA"). NÃO use o endereço de site, a marca comercial nem o texto do rodapé.
- categoria simples (ex: Mercado, Farmácia, Transporte). Quase sempre "despesa".`;
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
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  const out = await resp.json();
  return parseJsonSeguro(out?.content?.[0]?.text ?? "{}");
}

// ---- Whisper transcreve o áudio ----
async function transcrever(bytes: Uint8Array, mime: string): Promise<string> {
  const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4"
    : mime.includes("webm") ? "webm" : "m4a";
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

// ---- Claude transforma a frase em lançamento ----
async function fraseParaLancamento(frase: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  const prompt = `Hoje é ${hoje}. A pessoa falou sobre um gasto ou ganho. Transforme em lançamento.
Frase: "${frase}"
Responda APENAS um JSON válido:
{"valor": number, "data": "YYYY-MM-DD", "descricao": string, "categoria": string, "tipo": "despesa"|"receita"}
Regras: interprete "ontem"/"hoje"/"anteontem" em relação a ${hoje}. valor com ponto decimal. categoria simples.`;
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
  return parseJsonSeguro(out?.content?.[0]?.text ?? "{}");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "use POST" }, 405);

  // 🔒 Exige um usuário REAL logado. A chave pública (anon/publishable) fica
  // visível no app e, sozinha, passa no verify_jwt — mas aqui NÃO basta: quem
  // não tem sessão de usuário não gasta as APIs de IA. Fecha o abuso de custo.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user }, error: eAuth } = await authClient.auth.getUser(token);
  if (eAuth || !user) return json({ erro: "faça login para usar a IA" }, 401);
  if (!dentroDoLimite(user.id)) return json({ erro: "muitas requisições — tente em instantes" }, 429);

  try {
    const { kind, base64, mime } = await req.json();
    if (!base64 || !kind) return json({ erro: "faltou kind ou base64" }, 400);
    // limite anti-abuso (~6 MB) — foto/áudio normais ficam bem abaixo
    if (typeof base64 !== "string" || base64.length > 8_000_000) {
      return json({ erro: "arquivo muito grande" }, 413);
    }

    if (kind === "foto") {
      const dados = await lerComprovante(base64, mime || "image/jpeg");
      return json({ ok: true, kind, ...dados });
    }

    if (kind === "audio") {
      const bytes = base64ParaBytes(base64);
      const frase = await transcrever(bytes, mime || "audio/webm");
      if (!frase) return json({ ok: false, erro: "não entendi o áudio" });
      const dados = await fraseParaLancamento(frase);
      return json({ ok: true, kind, frase, ...dados });
    }

    return json({ erro: "kind inválido (use 'foto' ou 'audio')" }, 400);
  } catch (e) {
    console.error("erro:", e);
    return json({ ok: false, erro: "erro ao processar" }, 500);
  }
});
