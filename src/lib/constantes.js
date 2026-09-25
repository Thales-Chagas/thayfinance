/* ============================================================
   CONSTANTES
   ============================================================ */

export const STORAGE_KEY = "financas_app_data";
export const LOGIN_KEY = "financas_app_login";
// A trava local (PIN/foto/nome) é POR CONTA: cada usuário da nuvem tem a sua,
// senão uma conta herda o PIN/foto de outra que já usou este aparelho.
// Sem sessão (offline), cai na chave antiga (compatibilidade).
export const loginKey = (uid) => (uid ? `${LOGIN_KEY}:${uid}` : LOGIN_KEY);
export const TEMA_KEY = "financas_app_tema";
export const MIGR_KEY = "financas_app_migrado_"; // + userId: marca que já perguntamos da migração

// Captura, JÁ na abertura, se o app foi aberto por um link de "Esqueci a senha".
// Roda no import (antes do supabase-js processar e limpar o hash da URL), então
// é confiável para desviar o fluxo para a tela de nova senha em vez de "open".
export const URL_RECUPERACAO =
  typeof window !== "undefined" && /[#&?]type=recovery/.test(window.location.hash || "");

// Janela de desbloqueio: por 1h após desbloquear, recarregar/reabrir não pede
// PIN/biometria (pede de novo só depois de 1h).
export const DESBLOQUEIO_KEY = "financas_app_desbloqueio";
export const GRACA_MS = 60 * 60 * 1000; // 1 hora
// Login na nuvem (e-mail/senha) só é repedido a cada 24h.
export const NUVEM_MS = 24 * 60 * 60 * 1000; // 24 horas
export function marcarDesbloqueio() {
  try {
    localStorage.setItem(DESBLOQUEIO_KEY, String(Date.now()));
  } catch {
    /* sem armazenamento */
  }
}
export function limparDesbloqueio() {
  try {
    localStorage.removeItem(DESBLOQUEIO_KEY);
  } catch {
    /* sem armazenamento */
  }
}
export function desbloqueioRecente() {
  try {
    const t = Number(localStorage.getItem(DESBLOQUEIO_KEY) || 0);
    return t > 0 && Date.now() - t < GRACA_MS;
  } catch {
    return false;
  }
}

// Tour de boas-vindas: mostrado 1x por aparelho (instalar como app, biometria, Telegram).
export const TOUR_KEY = "financas_app_tour";



export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const MESES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
export const ANOS = [2024, 2025, 2026, 2027];

export const CATS_PESSOAL = [
  "Alimentação", "Transporte", "Moradia", "Saúde", "Lazer",
  "Salário", "Investimentos", "Outros",
];
export const CATS_EMPRESA = [
  "Faturamento", "Fornecedores", "Impostos", "Funcionários",
  "Infraestrutura", "Marketing", "Investimentos", "Outros",
];
