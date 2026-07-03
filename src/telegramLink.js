// ============================================================
//  Thayfinance — Conexão self-service com o bot do Telegram
//  O app (logado na nuvem) gera um código de 6 números e grava em
//  telegram_codigos. A pessoa manda "/conectar 123456" no bot; a Edge
//  Function valida e cria o vínculo. Aqui só falamos com o Supabase —
//  a RLS garante que cada um só mexe no próprio código/vínculo.
// ============================================================

import { supabase } from "./supabaseClient";

// @username do bot (link direto "Abrir o bot")
export const BOT_USERNAME = "ThayFinance_bot";
export const BOT_URL = `https://t.me/${BOT_USERNAME}`;

const VALIDADE_MIN = 15; // código expira em 15 min

// Código de 6 dígitos com gerador CRIPTOGRÁFICO (não Math.random, que é
// previsível). Rejeita valores fora da faixa pra não ter viés de módulo.
function codigo6Seguro() {
  const buf = new Uint32Array(1);
  // 4_294_800_000 = 900000 * 4772 (maior múltiplo <= 2^32): corta a cauda
  // pra o resto ser uniforme em 0..899999, sem viés de módulo.
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= 4_294_800_000);
  return String(100000 + (buf[0] % 900000));
}

// Gera um código de 6 dígitos e grava (1 código ativo por conta).
// Retorna { codigo, expiraEm }.
export async function gerarCodigoTelegram(userId, nome) {
  // só 1 código ativo por vez: limpa os anteriores desta conta
  await supabase.from("telegram_codigos").delete().eq("user_id", userId);
  const expiraEm = new Date(Date.now() + VALIDADE_MIN * 60_000).toISOString();
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const codigo = codigo6Seguro();
    const { error } = await supabase
      .from("telegram_codigos")
      .insert({ codigo, user_id: userId, nome: nome || null, expira_em: expiraEm });
    if (!error) return { codigo, expiraEm };
    // 23505 = código repetido (colisão) → tenta outro; qualquer outro erro sobe
    if (error.code !== "23505") throw error;
  }
  throw new Error("Não consegui gerar um código agora. Tente de novo.");
}

// Já está conectado? Devolve { chat_id, verificado_em } ou null.
export async function statusTelegram(userId) {
  const { data } = await supabase
    .from("telegram_links")
    .select("chat_id, verificado_em")
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

// Desliga o Telegram desta conta (apaga o vínculo e códigos pendentes).
export async function desconectarTelegram(userId) {
  await supabase.from("telegram_links").delete().eq("user_id", userId);
  await supabase.from("telegram_codigos").delete().eq("user_id", userId);
}
