// ============================================================
//  Thayfinance — Login na nuvem (Supabase Auth: e-mail + senha)
//  Camada fininha por cima do supabase-js. A sessão é persistida e
//  renovada automaticamente pelo próprio supabase-js (localStorage).
//
//  Confirmação de e-mail LIGADA: ao cadastrar, o usuário recebe um
//  link e só consegue entrar depois de confirmar (data.session vem
//  null até lá).
// ============================================================

import { supabase } from "./supabaseClient";

// Endereço-base do app para onde os links dos e-mails devem voltar.
// import.meta.env.BASE_URL é "/thayfinance/" na produção (GitHub Pages) e "/"
// no computador — então isto sempre aponta pra RAIZ CERTA do app, sem depender
// da "Site URL" do painel do Supabase e sem herdar uma sub-rota da página atual.
const appUrl = () => window.location.origin + import.meta.env.BASE_URL;

// Marca de tempo do ÚLTIMO login real na nuvem (e-mail/senha). Serve para o
// app repedir o login a cada 24h, mesmo com a sessão do Supabase persistida.
const LOGIN_NUVEM_KEY = "financas_app_login_nuvem";
export function marcarLoginNuvem() {
  try {
    localStorage.setItem(LOGIN_NUVEM_KEY, String(Date.now()));
  } catch {
    /* sem armazenamento */
  }
}
export function limparLoginNuvem() {
  try {
    localStorage.removeItem(LOGIN_NUVEM_KEY);
  } catch {
    /* sem armazenamento */
  }
}
// timestamp do último login (0 se nunca).
export function loginNuvemTs() {
  try {
    return Number(localStorage.getItem(LOGIN_NUVEM_KEY) || 0);
  } catch {
    return 0;
  }
}

// Cadastro por e-mail/senha. Guarda o nome nos metadados do usuário
// (o trigger handle_new_user copia isso pro profiles).
export async function cadastrar(email, senha, nome) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password: senha,
    options: { data: { nome: (nome || "").trim() }, emailRedirectTo: appUrl() },
  });
  if (error) throw error;
  // Com confirmação de e-mail ligada, a sessão só existe após confirmar.
  return { user: data.user, session: data.session, precisaConfirmar: !data.session };
}

// Entra com e-mail/senha. Lança erro se as credenciais estiverem erradas
// ou se o e-mail ainda não foi confirmado.
export async function entrar(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  });
  if (error) throw error;
  marcarLoginNuvem(); // conta os 24h a partir de agora
  return data.session;
}

// Reenvia o e-mail de confirmação (caso não tenha chegado).
export async function reenviarConfirmacao(email) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: appUrl() },
  });
  if (error) throw error;
}

// Envia e-mail para redefinir a senha ("Esqueci a senha").
// redirectTo faz o link do e-mail voltar para ESTE app (localhost no dev,
// GitHub Pages na produção) — precisa estar na lista de Redirect URLs do painel.
export async function redefinirSenha(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
  if (error) throw error;
}

// Grava a senha nova. Usado na tela que aparece DEPOIS de clicar no link do
// e-mail — nesse momento o supabase-js já criou uma sessão de recuperação,
// então updateUser aplica a nova senha no usuário logado por esse link.
export async function atualizarSenha(novaSenha) {
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw error;
  marcarLoginNuvem(); // acabou de entrar pelo link → conta os 24h
}

// Garante que o nome da pessoa esteja salvo nos metadados da conta na nuvem.
// Usado p/ contas antigas criadas sem nome: assim a saudação aparece em
// qualquer aparelho, não só onde existe a trava local. Best-effort (silencioso).
export async function definirNomeNuvem(nome) {
  const limpo = (nome || "").trim();
  if (!limpo) return;
  try {
    await supabase.auth.updateUser({ data: { nome: limpo } });
  } catch {
    /* sem rede / sem sessão — tenta de novo numa próxima abertura */
  }
}

// Encerra a sessão na nuvem (logout de verdade).
export async function sairNuvem() {
  await supabase.auth.signOut();
}

// Sessão atual (ou null). Usado ao abrir o app.
export async function sessaoAtual() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

// Usuário logado (ou null).
export async function usuarioAtual() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

// Observa mudanças de login/logout/refresh. Devolve uma função para parar.
// O callback recebe (sessao, evento) — o evento "PASSWORD_RECOVERY" indica
// que a pessoa chegou pelo link de "Esqueci a senha".
export function aoMudarAuth(callback) {
  const { data } = supabase.auth.onAuthStateChange((evento, sessao) => callback(sessao, evento));
  return () => data.subscription.unsubscribe();
}
