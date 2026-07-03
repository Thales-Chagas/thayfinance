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
async function responder(chatId: number, texto: string, html = false) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      ...(html ? { parse_mode: "HTML" } : {}),
    }),
  });
}

// escapa texto do usuário/IA para não quebrar o HTML do Telegram
function escHtml(s: string | null): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 2026-07-01 -> 01/07/2026
function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// emoji que combina com a categoria do lançamento
function emojiCategoria(nome: string | null): string {
  const n = (nome || "").toLowerCase();
  const tem = (...ks: string[]) => ks.some((k) => n.includes(k));
  if (tem("combust", "gasolina", "posto", "etanol", "diesel")) return "⛽";
  if (tem("mercado", "supermerc", "feira", "hortifr", "açougue", "acougue")) return "🛒";
  if (tem("farm", "remedio", "remédio", "saude", "saúde", "hospital", "medic", "consulta", "exame")) return "💊";
  if (tem("transp", "uber", "onibus", "ônibus", "99", "taxi", "táxi", "metro", "metrô", "passagem", "pedágio", "pedagio", "estaciona")) return "🚗";
  if (tem("restaur", "lanche", "aliment", "comida", "ifood", "padaria", "cafe", "café", "pizza", "bar")) return "🍽️";
  if (tem("alug", "moradia", "condom", "casa", "imóvel", "imovel")) return "🏠";
  if (tem("agua", "água", "luz", "energia", "gas ", "gás", "conta")) return "💡";
  if (tem("telefone", "celular", "internet", "wifi", "wi-fi", "tim", "vivo", "claro")) return "📱";
  if (tem("salario", "salário", "renda", "pagamento", "receb", "venda")) return "💵";
  if (tem("lazer", "cinema", "viagem", "passeio", "festa", "show")) return "🎉";
  if (tem("educ", "escola", "curso", "faculdade", "livro", "mensalidade")) return "📚";
  if (tem("roupa", "vestu", "calçad", "calcad", "sapato", "moda")) return "👕";
  if (tem("pet", "animal", "veterin", "ração", "racao")) return "🐾";
  if (tem("beleza", "salao", "salão", "cabelo", "estetica", "estética", "unha", "manicure")) return "💅";
  return "🏷️";
}

// monta a mensagem de confirmação bonita (HTML do Telegram)
// Decide se o lançamento é da EMPRESA. PADRÃO = pessoal; só vira
// empresarial quando a mensagem cita termos claramente empresariais.
function detectarModo(texto: string | null | undefined): "pessoal" | "empresarial" {
  const t = (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos
  const termos =
    /\b(empresa|empresas|empresarial|empresariais|da empresa|pra empresa|para empresa|firma|cnpj|negocio|negocios|comercial|corporativ[oa]|pj|pessoa juridica)\b/;
  return termos.test(t) ? "empresarial" : "pessoal";
}

// Escolhe 👩/👨 pelo primeiro nome (heurística PT-BR: termina em "a" = feminino,
// com algumas exceções conhecidas). Neutro 🧑 quando não dá pra saber.
function emojiPessoa(nome: string | null | undefined): string {
  const prim = (nome || "")
    .trim().split(/\s+/)[0].toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!prim) return "🧑";
  const feminino = ["beatriz", "raquel", "ester", "esther", "isis", "carmen", "ines", "mirian", "miriam", "abigail", "rute", "noemi", "dulce", "ruth", "esther", "heloa"];
  const masculino = ["luca", "caua", "noa", "josua", "dara"]; // terminam em "a" mas são masculinos
  if (feminino.includes(prim)) return "👩";
  if (masculino.includes(prim)) return "👨";
  return prim.endsWith("a") ? "👩" : "👨";
}

function montarResposta(dados: any, modo: "pessoal" | "empresarial", nome?: string | null): string {
  const linha = "━━━━━━━━━━━━━━━━";
  const local = dados.estabelecimento || dados.descricao;
  const rotuloLocal = dados.estabelecimento ? "📍 <b>Local</b>" : "📝 <b>Descrição</b>";
  const badgeModo = modo === "empresarial"
    ? "🏢 <i>Conta Empresarial</i>"
    : `${emojiPessoa(nome)} <i>Conta Pessoal</i>`;
  const p: string[] = [
    "✅ <b>Lançamento salvo com sucesso!</b>",
    badgeModo,
    "",
    linha,
    "",
    "💰 <b>Valor</b>",
    fmtBR(dados.valor),
    "",
    `${emojiCategoria(dados.categoria)} <b>Categoria</b>`,
    escHtml(dados.categoria || "—"),
  ];
  if (local) p.push("", rotuloLocal, escHtml(local));
  p.push(
    "",
    "📅 <b>Data</b>",
    dataBR(dados.data),
    "",
    linha,
    "",
    "💚 <i>ThayFinance · Controle Financeiro</i>",
  );
  return p.join("\n");
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

async function acharCategoria(userId: string, modo: string, nome: string | null): Promise<string | null> {
  if (!nome) return null;
  const { data: existe } = await db.from("categorias")
    .select("id").eq("user_id", userId).eq("modo", modo).ilike("nome", nome).maybeSingle();
  if (existe) return existe.id;
  const { data: nova } = await db.from("categorias")
    .insert({ user_id: userId, modo, nome }).select("id").single();
  return nova?.id ?? null;
}

const fmtBR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function gravarTransacao(userId: string, modo: string, dados: any) {
  const catId = await acharCategoria(userId, modo, dados.categoria);
  const { data: tx } = await db.from("transacoes").insert({
    user_id: userId, modo, tipo: dados.tipo, status: "ok",
    data: dados.data, valor: dados.valor,
    descricao: dados.descricao || dados.estabelecimento || null,
    origem: "telegram", categoria_id: catId,
  }).select("id").single();
  return tx?.id ?? null;
}

// ------------------------------------------------------------
// Tutorial completo (mostrado a quem JÁ está conectado)
function textoTutorial(): string {
  return [
    "👋 <b>Oi! Eu sou o assistente do ThayFinance.</b>",
    "",
    "Me mande de 3 jeitos:",
    "🎙️ um <b>áudio</b> falando o gasto",
    "📷 uma <b>foto do comprovante</b>",
    "✍️ ou <b>escreva</b> (ex: \"gastei 50 no mercado\")",
    "",
    "━━━━━━━━━━━━━━━━",
    "👤 <b>Pessoal x 🏢 Empresarial</b>",
    "",
    "Por padrão eu lanço tudo na sua conta <b>Pessoal</b>.",
    "Pra jogar na <b>Empresarial</b>, é só citar a <b>empresa</b> na mensagem. Exemplos:",
    "• <i>\"paguei 200 de energia da empresa\"</i>",
    "• <i>\"recebi 500, faturamento empresarial\"</i>",
    "• numa <b>foto</b>, escreva <b>empresa</b> na legenda ao enviar",
    "",
    "Palavras que mando pra Empresarial: <i>empresa, empresarial, firma, CNPJ, negócio, comercial</i>.",
    "",
    "💚 Bora começar!",
  ].join("\n");
}

// Instruções de conexão (mostrado a quem ainda NÃO está na allowlist)
function textoComoConectar(): string {
  return [
    "👋 <b>Oi! Eu sou o assistente do ThayFinance.</b>",
    "",
    "Antes de começar, preciso saber de quem é essa conversa. É rapidinho:",
    "",
    "1️⃣ Abra o <b>app ThayFinance</b> e entre na sua conta",
    "2️⃣ Toque em <b>Conectar Telegram</b> (na barra lateral)",
    "3️⃣ O app mostra um <b>código de 6 números</b>",
    "4️⃣ Me mande aqui: <code>/conectar 123456</code>",
    "",
    "🔒 Isso liga este Telegram à sua conta pra ninguém mais lançar por você.",
    "",
    "💚 <i>ThayFinance · Controle Financeiro</i>",
  ].join("\n");
}

// ------------------------------------------------------------
// Conexão self-service: valida o código de 6 dígitos vindo do app e
// cria o vínculo chat_id -> user_id. Código é de USO ÚNICO e expira.
async function tratarConectar(chatId: number, texto: string) {
  const m = texto.match(/(\d{6})/);
  if (!m) {
    await responder(
      chatId,
      "Pra conectar, mande <b>/conectar</b> com o código de 6 números que aparece no app.\nExemplo: <code>/conectar 123456</code>",
      true,
    );
    return;
  }
  const codigo = m[1];
  // higiene: apaga códigos já expirados (de qualquer um)
  await db.from("telegram_codigos").delete().lt("expira_em", new Date().toISOString());
  const { data: c } = await db.from("telegram_codigos")
    .select("user_id, nome, expira_em").eq("codigo", codigo).maybeSingle();
  if (!c) {
    await responder(
      chatId,
      "❌ <b>Código inválido ou expirado.</b>\nAbra o app em <b>Conectar Telegram</b>, gere um código novo e me mande de novo. 🙂",
      true,
    );
    return;
  }
  // vincula (chat_id é PK: se a pessoa reconectar com outra conta, atualiza)
  const { error: eLink } = await db.from("telegram_links").upsert({
    chat_id: chatId,
    user_id: c.user_id,
    nome: c.nome,
    verificado_em: new Date().toISOString(),
  });
  if (eLink) {
    console.error("erro ao vincular telegram_links:", eLink);
    await responder(chatId, "Deu um probleminha ao conectar. Tente de novo em instantes. 🙏");
    return;
  }
  // código é de uso único
  await db.from("telegram_codigos").delete().eq("codigo", codigo);
  await responder(
    chatId,
    [
      "✅ <b>Tudo certo! Você está conectado.</b>",
      c.nome ? `\n👤 Conta: <b>${escHtml(c.nome)}</b>` : "",
      "",
      "Agora é só me mandar:",
      "🎙️ um <b>áudio</b> falando o gasto",
      "📷 uma <b>foto do comprovante</b>",
      "✍️ ou <b>escrever</b> (ex: \"gastei 50 no mercado\")",
      "",
      "💚 <i>ThayFinance · Controle Financeiro</i>",
    ].join("\n"),
    true,
  );
}

// ============================================================
Deno.serve(async (req) => {
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

      // 1.5) /conectar <código> — funciona ANTES da allowlist, porque é
      //      exatamente por aqui que a pessoa ENTRA na allowlist. O app gera
      //      o código (tabela telegram_codigos) e a pessoa digita aqui.
      const textoCmd = typeof msg.text === "string" ? msg.text.trim() : "";
      if (/^\/conectar\b/i.test(textoCmd)) {
        if (!dentroDoLimite(chatId)) {
          await responder(chatId, "Muitas tentativas seguidas. Espere um minutinho e tente de novo. 🙂");
          return;
        }
        await tratarConectar(chatId, textoCmd);
        return;
      }
      // /start /ajuda /help respondem MESMO sem conexão, pra guiar o onboarding
      if (/^\/(start|ajuda|help)\b/i.test(textoCmd)) {
        if (!dentroDoLimite(chatId)) return;
        const { data: jaLigado } = await db.from("telegram_links")
          .select("chat_id").eq("chat_id", chatId).maybeSingle();
        await responder(chatId, jaLigado ? textoTutorial() : textoComoConectar(), true);
        return;
      }

      // 2) allowlist — chat_id precisa estar cadastrado
      const { data: link } = await db.from("telegram_links")
        .select("user_id, nome").eq("chat_id", chatId).maybeSingle();
      if (!link) {
        console.log(`chat_id nao autorizado: ${chatId} (ignorado)`);
        return; // silêncio: não confirma que o bot existe
      }
      const userId = link.user_id;
      const nome = link.nome as string | null;

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
        if (!dados.descricao) dados.descricao = frase;
        const modo = detectarModo(frase);
        await gravarTransacao(userId, modo, dados);
        await responder(chatId, montarResposta(dados, modo, nome), true);
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
        // legenda da foto decide empresa/pessoal (ex.: escrever "empresa" ao enviar)
        const modo = detectarModo(msg.caption);
        const txId = await gravarTransacao(userId, modo, dados);
        await db.from("comprovantes").insert({
          user_id: userId, transacao_id: txId, storage_path: caminho, mime_type: mime,
          tamanho_bytes: bytes.length, origem: "telegram", ocr_status: "concluido",
          ocr_bruto: dados, extraido_valor: dados.valor, extraido_data: dados.data,
          extraido_estabelecimento: dados.estabelecimento, extraido_categoria: dados.categoria,
        });
        await responder(chatId, montarResposta(dados, modo, nome) + "\n\n🧾 <i>A foto ficou guardada na sua conta.</i>", true);
        return;
      }

      // ---- TEXTO ----
      if (typeof msg.text === "string" && msg.text.trim()) {
        const dados = validarLancamento(await fraseParaLancamento(msg.text));
        if (!dados) { await responder(chatId, "Não achei um valor nessa mensagem. Tente algo como: \"gastei 50 no mercado ontem\". 🙂"); return; }
        if (!dados.descricao) dados.descricao = msg.text;
        const modo = detectarModo(msg.text);
        await gravarTransacao(userId, modo, dados);
        await responder(chatId, montarResposta(dados, modo, nome), true);
        return;
      }

      await responder(chatId, "😊 Me mande um <b>áudio</b>, uma <b>foto de comprovante</b> ou <b>escreva</b> o gasto que eu lanço pra você.", true);
    } catch (e) {
      console.error("erro ao processar:", e);
    }
  };

  EdgeRuntime.waitUntil(processar());
  return new Response("ok", { status: 200 });
});
