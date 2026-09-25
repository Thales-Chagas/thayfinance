import React, { useState } from "react";
import logoUrl from "../logo.png";
import bgLoginUrl from "../bg-login.jpg";
import { User, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import { cadastrar as cadastrarNuvem, entrar as entrarNuvem, reenviarConfirmacao, redefinirSenha, atualizarSenha } from "../cloudAuth";

// Campo de formulário da TelaAuth: rótulo + ícone à esquerda e, se for
// senha, um "olho" à direita para mostrar/ocultar.
export function CampoAuth({ label, icon: Icon, type = "text", value, onChange, placeholder, senha }) {
  const [ver, setVer] = useState(false);
  const tipo = senha ? (ver ? "text" : "password") : type;
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-emerald-300/90">{label}</label>
      <div className="relative">
        <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/70" />
        <input
          type={tipo}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-2.5 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
        />
        {senha && (
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-emerald-300"
          >
            {ver ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

// Tela de acesso à NUVEM (Supabase Auth): entrar ou criar conta por
// e-mail + senha. É o portão externo; depois vem a tranca rápida (PIN/bio).
export function TelaAuth() {
  const [aba, setAba] = useState("entrar"); // entrar | criar
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [confirmar, setConfirmar] = useState(false); // mostrou "confirme seu e-mail"

  function limpar() {
    setErro("");
    setInfo("");
  }

  async function fazerEntrar(e) {
    e.preventDefault();
    limpar();
    if (!email.trim() || !senha) return setErro("Preencha e-mail e senha.");
    setCarregando(true);
    try {
      await entrarNuvem(email, senha);
      // o App observa a mudança de sessão (aoMudarAuth) e segue sozinho
    } catch (err) {
      const m = String(err?.message || "");
      // Mensagem única p/ credencial errada E e-mail não confirmado: não
      // revela se aquele e-mail já tem conta (evita enumeração). Ainda ajuda
      // a usuária citando a confirmação como possibilidade, sem afirmá-la.
      if (/not confirmed|invalid login|invalid credential/i.test(m))
        setErro("E-mail ou senha incorretos. Se você acabou de criar a conta, confirme o e-mail pelo link que enviamos.");
      else setErro("Não consegui entrar agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  async function fazerCriar(e) {
    e.preventDefault();
    limpar();
    if (!nome.trim()) return setErro("Digite como você quer ser chamada.");
    if (!email.trim()) return setErro("Digite seu e-mail.");
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    setCarregando(true);
    try {
      const { precisaConfirmar } = await cadastrarNuvem(email, senha, nome);
      if (precisaConfirmar) setConfirmar(true);
    } catch (err) {
      const m = String(err?.message || "");
      if (/already|registered|exists/i.test(m)) setErro("Esse e-mail já tem conta. Use a aba \"Entrar\".");
      else if (/weak|password|least/i.test(m)) setErro("Senha muito fraca. Use pelo menos 8 caracteres.");
      else setErro("Não consegui criar a conta agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  async function reenviar() {
    limpar();
    try {
      await reenviarConfirmacao(email);
      setInfo("Reenviei o e-mail de confirmação. ✅");
    } catch {
      setErro("Não consegui reenviar agora. Tente de novo em instantes.");
    }
  }

  async function esqueci() {
    limpar();
    if (!email.trim()) return setErro("Digite seu e-mail acima para eu enviar o link de nova senha.");
    try {
      await redefinirSenha(email);
      setInfo("Enviei um link para redefinir a senha no seu e-mail. ✅");
    } catch {
      setErro("Não consegui enviar agora. Tente de novo em instantes.");
    }
  }

  const criando = aba === "criar";
  const cardCls =
    "rounded-3xl border border-emerald-400/15 bg-slate-900/60 p-7 shadow-2xl shadow-emerald-950/60 backdrop-blur-xl";
  const molduraStyle = {
    backgroundColor: "#04141a",
    backgroundImage: `url(${bgLoginUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  const rodape = (
    <div className="relative mt-6 flex items-center gap-1.5 text-[11px] text-slate-400/80">
      <Lock size={12} /> Segurança · Privacidade · Confiança
    </div>
  );

  // Tela intermediária: pediu para confirmar o e-mail
  if (confirmar) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10" style={molduraStyle}>
        <div className="pointer-events-none absolute inset-0 bg-slate-950/40" />
        <div className={"relative w-full max-w-sm text-center " + cardCls}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
            <Mail size={28} />
          </div>
          <h1 className="text-xl font-bold text-white">Confirme seu e-mail</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enviei um link de confirmação para <b className="text-slate-200">{email}</b>. Abra seu e-mail e clique no link para ativar a conta. Depois é só entrar. 🙂
          </p>
          {info && <p className="mt-3 text-sm text-emerald-300">{info}</p>}
          {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
          <button onClick={reenviar} className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            Reenviar e-mail
          </button>
          <button
            onClick={() => {
              setConfirmar(false);
              setAba("entrar");
              limpar();
            }}
            className="mt-2 w-full text-center text-xs text-slate-400 underline-offset-2 hover:underline"
          >
            Já confirmei — voltar para Entrar
          </button>
        </div>
        {rodape}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10" style={molduraStyle}>
      <div className="pointer-events-none absolute inset-0 bg-slate-950/40" />
      <div className={"relative w-full max-w-sm " + cardCls}>
        <div className="mb-5 flex flex-col items-center text-center">
          <img src={logoUrl} alt="Educação Financeira" className="h-24 object-contain" />
          <h1 className="mt-1 text-2xl font-bold text-white">
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              {criando ? "Criar" : "Entrar"}
            </span>{" "}
            {criando ? "sua conta" : "na conta"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">Seus dados ficam guardados com segurança na sua conta.</p>
        </div>

        {/* Abas Entrar / Criar conta */}
        <div className="mb-5 flex gap-1 rounded-xl border border-white/5 bg-slate-950/40 p-1">
          {[
            ["entrar", "Entrar"],
            ["criar", "Criar conta"],
          ].map(([v, r]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setAba(v);
                limpar();
              }}
              className={
                "flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold transition " +
                (aba === v
                  ? "bg-slate-800/80 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "text-slate-400 hover:text-slate-200")
              }
            >
              {r}
            </button>
          ))}
        </div>

        {criando ? (
          <form onSubmit={fazerCriar} className="space-y-4">
            <CampoAuth label="Como você quer ser chamada?" icon={User} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
            <CampoAuth label="E-mail" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            <CampoAuth label="Crie uma senha (mín. 8 caracteres)" icon={Lock} senha value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            {info && <p className="text-sm text-emerald-300">{info}</p>}
            <button type="submit" disabled={carregando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-60">
              {carregando ? "Criando..." : "Criar conta"} {!carregando && <ArrowRight size={16} />}
            </button>
          </form>
        ) : (
          <form onSubmit={fazerEntrar} className="space-y-4">
            <CampoAuth label="E-mail" icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            <CampoAuth label="Senha" icon={Lock} senha value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            {info && <p className="text-sm text-emerald-300">{info}</p>}
            <button type="submit" disabled={carregando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-60">
              {carregando ? "Entrando..." : "Entrar"} {!carregando && <ArrowRight size={16} />}
            </button>
            <button type="button" onClick={esqueci} className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:underline">
              Esqueci minha senha
            </button>
          </form>
        )}

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck size={14} className="text-emerald-400/70" />
          Seus dados estão protegidos com criptografia de ponta
        </div>
      </div>
      {rodape}
    </div>
  );
}

// Tela que aparece DEPOIS de clicar no link de "Esqueci a senha": a pessoa
// digita a senha nova (a sessão de recuperação já está ativa). Ao salvar,
// a senha é gravada e o app segue para dentro.
export function TelaNovaSenha({ onPronto }) {
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [ok, setOk] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== conf) return setErro("As duas senhas precisam ser iguais.");
    setCarregando(true);
    try {
      await atualizarSenha(senha);
      setOk(true);
      setTimeout(() => onPronto?.(), 1200);
    } catch (err) {
      const m = String(err?.message || "");
      if (/session|expired|token|missing|not found/i.test(m))
        setErro('Este link expirou. Volte à tela de entrada e peça outro em "Esqueci minha senha".');
      else setErro("Não consegui salvar a senha agora. Tente de novo em instantes.");
      setCarregando(false);
    }
  }

  const molduraStyle = {
    backgroundColor: "#04141a",
    backgroundImage: `url(${bgLoginUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  const cardCls =
    "rounded-3xl border border-emerald-400/15 bg-slate-900/60 p-7 shadow-2xl shadow-emerald-950/60 backdrop-blur-xl";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10" style={molduraStyle}>
      <div className="pointer-events-none absolute inset-0 bg-slate-950/40" />
      <div className={"relative w-full max-w-sm " + cardCls}>
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
            <Lock size={28} />
          </div>
          <h1 className="text-xl font-bold text-white">Criar senha nova</h1>
          <p className="mt-1 text-sm text-slate-400">Escolha uma senha para acessar sua conta.</p>
        </div>

        {ok ? (
          <p className="rounded-xl bg-emerald-500/10 p-4 text-center text-sm font-medium text-emerald-300">
            Senha salva! Entrando… ✅
          </p>
        ) : (
          <form onSubmit={salvar} className="space-y-4">
            <CampoAuth label="Nova senha (mín. 8 caracteres)" icon={Lock} senha value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
            <CampoAuth label="Repita a nova senha" icon={Lock} senha value={conf} onChange={(e) => setConf(e.target.value)} placeholder="••••••••" />
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            <button type="submit" disabled={carregando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-60">
              {carregando ? "Salvando..." : "Salvar senha"} {!carregando && <ArrowRight size={16} />}
            </button>
          </form>
        )}
      </div>
      <div className="relative mt-6 flex items-center gap-1.5 text-[11px] text-slate-400/80">
        <Lock size={12} /> Segurança · Privacidade · Confiança
      </div>
    </div>
  );
}
