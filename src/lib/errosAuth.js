/* ============================================================
   MENSAGENS DE ERRO DO LOGIN (Supabase Auth → português claro)
   Regras:
   - nunca revelar se um e-mail tem conta (login e recuperação);
   - separar "sem internet", "muitas tentativas" e falha do servidor.
   ============================================================ */

const SEM_INTERNET = "Você está sem internet. Confira a conexão e tente de novo.";
const MUITAS_TENTATIVAS = "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";

const PADRAO = {
  entrar: "Não consegui entrar agora. Tente de novo em instantes.",
  criar: "Não consegui criar a conta agora. Tente de novo em instantes.",
  recuperar: "Não consegui enviar o link agora. Tente de novo em instantes.",
  reenviar: "Não consegui reenviar agora. Tente de novo em instantes.",
  novaSenha: "Não consegui salvar a senha agora. Tente de novo em instantes.",
};

export function mensagemErroAuth(erro, contexto = "entrar", online = typeof navigator === "undefined" ? true : navigator.onLine) {
  const m = String(erro?.message || erro || "");
  const status = erro?.status;

  if (online === false || /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(m)) return SEM_INTERNET;
  if (status === 429 || /rate limit|security purposes|too many/i.test(m)) return MUITAS_TENTATIVAS;

  if (contexto === "entrar" && /invalid login|invalid credential|not confirmed|invalid grant/i.test(m))
    return "E-mail ou senha incorretos. Se você acabou de criar a conta, confirme o e-mail pelo link que enviamos.";

  if (contexto === "criar") {
    if (/already|registered|exists/i.test(m)) return 'Esse e-mail já tem conta. Use "Entrar".';
    if (/weak|password.*(short|least|characters)|least.*characters/i.test(m)) return "Senha muito fraca. Use pelo menos 8 caracteres, misturando letras e números.";
    if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return "Confira o e-mail digitado.";
  }

  if (contexto === "novaSenha") {
    if (/should be different|same.*password|different from the old/i.test(m)) return "A senha nova precisa ser diferente da atual.";
    if (/session|expired|token|missing|not found|jwt/i.test(m))
      return 'Este link expirou. Volte à tela de entrada e peça outro em "Esqueci a senha".';
    if (/weak|least|characters/i.test(m)) return "Senha muito fraca. Use pelo menos 8 caracteres.";
  }

  return PADRAO[contexto] || PADRAO.entrar;
}

// E-mail com cara de e-mail (a conferência de verdade é o link de confirmação)
export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());

// Dica específica para o e-mail digitado (null = está ok)
export function problemaEmail(e) {
  const v = String(e || "").trim();
  if (!v) return "Digite seu e-mail.";
  if (!v.includes("@")) return "Falta o @ no e-mail.";
  if (!emailValido(v)) return "Confira o e-mail — falta o final, ex.: @gmail.com";
  return null;
}
