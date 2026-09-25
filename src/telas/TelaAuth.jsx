import React, { useRef, useState } from "react";
import { ChevronLeft, Mail, Check, Circle } from "lucide-react";
import { cadastrar as cadastrarNuvem, entrar as entrarNuvem, reenviarConfirmacao, redefinirSenha, atualizarSenha } from "../cloudAuth";
import { mensagemErroAuth, problemaEmail } from "../lib/errosAuth";
import { LayoutAuth, CampoTexto, CampoSenha, BotaoEnviar, LinkAuth, Aviso, AlternarModo, useEspera } from "./auth/ComponentesAuth";

/* ============================================================
   ENTRADA NA NUVEM (Supabase Auth): entrar, criar conta, recuperar
   senha e confirmar e-mail. Depois vem a tranca rápida (PIN/biometria).
   A senha nunca é guardada pelo app — só o supabase-js mantém a sessão.
   ============================================================ */

const TITULOS = {
  entrar: ["Entre na sua conta", "Suas contas e lançamentos te esperando."],
  criar: ["Crie sua conta", "Grátis. Seus dados ficam guardados na sua conta."],
  recuperar: ["Recuperar senha", "Digite o e-mail da sua conta. Vamos enviar um link para criar uma senha nova."],
};

export function TelaAuth() {
  const [tela, setTela] = useState("entrar"); // entrar | criar | recuperar | confirmar
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [emailTocado, setEmailTocado] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const [info, setInfo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const espera = useEspera(60);
  const senhaRef = useRef(null);
  const emailRef = useRef(null);

  const erroEmail = emailTocado || tentouEnviar ? problemaEmail(email) : null;
  const senhaCurta = senha.length < 8;

  function irPara(t) {
    setTela(t);
    setErro("");
    setInfo("");
    setTentouEnviar(false);
    if (t !== "entrar") setSenha("");
  }

  async function fazerEntrar(e) {
    e.preventDefault();
    if (carregando) return;
    setTentouEnviar(true);
    setErro("");
    if (problemaEmail(email)) return emailRef.current?.focus();
    if (!senha) return senhaRef.current?.focus();
    setCarregando(true);
    try {
      await entrarNuvem(email, senha);
      // o App percebe a sessão nova (aoMudarAuth) e segue sozinho
    } catch (err) {
      setErro(mensagemErroAuth(err, "entrar"));
      setSenha("");
      senhaRef.current?.focus();
    } finally {
      setCarregando(false);
    }
  }

  async function fazerCriar(e) {
    e.preventDefault();
    if (carregando) return;
    setTentouEnviar(true);
    setErro("");
    if (!nome.trim()) return document.getElementById("auth-nome")?.focus();
    if (problemaEmail(email)) return emailRef.current?.focus();
    if (senhaCurta) return senhaRef.current?.focus();
    setCarregando(true);
    try {
      const { precisaConfirmar } = await cadastrarNuvem(email, senha, nome);
      if (precisaConfirmar) {
        setTela("confirmar");
        setSenha("");
        espera.iniciar();
      }
    } catch (err) {
      setErro(mensagemErroAuth(err, "criar"));
    } finally {
      setCarregando(false);
    }
  }

  async function fazerRecuperar(e) {
    e.preventDefault();
    if (carregando || espera.faltam) return;
    setTentouEnviar(true);
    setErro("");
    setInfo("");
    if (problemaEmail(email)) return emailRef.current?.focus();
    setCarregando(true);
    try {
      await redefinirSenha(email);
      // Mensagem neutra: não diz se existe conta com esse e-mail.
      setInfo("Se houver uma conta com esse e-mail, o link chega em alguns minutos. Confira também a caixa de spam.");
      espera.iniciar();
    } catch (err) {
      setErro(mensagemErroAuth(err, "recuperar"));
    } finally {
      setCarregando(false);
    }
  }

  async function reenviar() {
    if (carregando || espera.faltam) return;
    setErro("");
    setInfo("");
    setCarregando(true);
    try {
      await reenviarConfirmacao(email);
      setInfo("Reenviamos o e-mail de confirmação.");
      espera.iniciar();
    } catch (err) {
      setErro(mensagemErroAuth(err, "reenviar"));
    } finally {
      setCarregando(false);
    }
  }

  // ---------- Confirmar e-mail ----------
  if (tela === "confirmar") {
    return (
      <LayoutAuth
        titulo="Confirme seu e-mail"
        subtitulo={
          <>
            Enviamos um link para <b className="text-white">{email.trim()}</b>.
          </>
        }
        topo={
          <div className="auth-titulo mt-10 flex h-16 w-16 items-center justify-center rounded-full border border-[#3ee0a8]/40 bg-[#3ee0a8]/10 text-[#3ee0a8]">
            <Mail size={28} aria-hidden />
          </div>
        }
      >
        <div className="space-y-4">
          <ol className="space-y-2.5 rounded-2xl border border-[#1c3a40] bg-white/[0.03] p-4 text-base text-[#c8dcd5]">
            {["Abra o e-mail do Thayfinance", 'Toque em "Confirmar"', "Volte aqui e entre"].map((p, i) => (
              <li key={p} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3ee0a8]/15 text-sm font-bold text-[#3ee0a8]">{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
          <Aviso tipo="erro">{erro}</Aviso>
          <Aviso tipo="ok">{info}</Aviso>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              irPara("entrar");
              setTimeout(() => senhaRef.current?.focus(), 50);
            }}
          >
            <BotaoEnviar>Já confirmei, entrar</BotaoEnviar>
          </form>
          <div className="flex flex-wrap items-center justify-center gap-x-4 text-sm text-[#8fa9a2]">
            <span>Não chegou?</span>
            <LinkAuth onClick={reenviar} disabled={carregando || !!espera.faltam}>
              {espera.faltam ? `Reenviar em ${espera.rotulo}` : "Reenviar e-mail"}
            </LinkAuth>
            <LinkAuth onClick={() => irPara("criar")}>Trocar e-mail</LinkAuth>
          </div>
        </div>
      </LayoutAuth>
    );
  }

  // ---------- Recuperar senha ----------
  if (tela === "recuperar") {
    const [titulo, sub] = TITULOS.recuperar;
    return (
      <LayoutAuth
        titulo={titulo}
        subtitulo={sub}
        topo={
          <div className="mt-4">
            <button
              type="button"
              onClick={() => irPara("entrar")}
              className="-ml-2 flex h-11 items-center gap-1 rounded-lg px-2 text-base font-medium text-[#b7cdc6] hover:text-white"
            >
              <ChevronLeft size={20} /> Voltar para entrar
            </button>
          </div>
        }
      >
        <form onSubmit={fazerRecuperar} className="space-y-4" noValidate>
          <CampoTexto
            id="auth-email"
            rotulo="E-mail"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTocado(true)}
            erro={erroEmail}
            entradaRef={emailRef}
          />
          <Aviso tipo="erro">{erro}</Aviso>
          <Aviso tipo="ok">{info}</Aviso>
          <BotaoEnviar carregando={carregando} textoCarregando="Enviando…" disabled={carregando || !!espera.faltam}>
            {espera.faltam ? `Reenviar em ${espera.rotulo}` : info ? "Enviar de novo" : "Enviar link"}
          </BotaoEnviar>
        </form>
      </LayoutAuth>
    );
  }

  // ---------- Entrar / Criar conta ----------
  const criando = tela === "criar";
  const [titulo, sub] = TITULOS[tela];
  return (
    <LayoutAuth titulo={titulo} subtitulo={sub}>
      <div className="space-y-5">
        <AlternarModo
          valor={tela}
          onMudar={irPara}
          opcoes={[
            ["entrar", "Entrar"],
            ["criar", "Criar conta"],
          ]}
        />

        <form onSubmit={criando ? fazerCriar : fazerEntrar} className="space-y-4" noValidate>
          {criando && (
            <CampoTexto
              id="auth-nome"
              className="anim-auth"
              rotulo="Como quer ser chamado(a)?"
              type="text"
              name="name"
              autoComplete="given-name"
              autoCapitalize="words"
              enterKeyHint="next"
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              erro={tentouEnviar && !nome.trim() ? "Digite como quer ser chamado(a)." : null}
            />
          )}
          <CampoTexto
            id="auth-email"
            rotulo="E-mail"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTocado(true)}
            erro={erroEmail}
            entradaRef={emailRef}
          />
          <CampoSenha
            id="auth-senha"
            rotulo={criando ? "Crie uma senha" : "Senha"}
            name="password"
            autoComplete={criando ? "new-password" : "current-password"}
            enterKeyHint={criando ? "done" : "go"}
            placeholder={criando ? "Pelo menos 8 caracteres" : "Sua senha"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            entradaRef={senhaRef}
            erro={tentouEnviar && !criando && !senha ? "Digite sua senha." : tentouEnviar && criando && senhaCurta ? "A senha precisa ter pelo menos 8 caracteres." : null}
            direita={!criando && <LinkAuth onClick={() => irPara("recuperar")} className="-my-3">Esqueci a senha</LinkAuth>}
            dica={
              criando ? (
                <ul className="space-y-1" aria-label="Requisitos da senha">
                  <Requisito ok={!senhaCurta}>
                    Pelo menos 8 caracteres{senha && senhaCurta ? ` (faltam ${8 - senha.length})` : ""}
                  </Requisito>
                  <Requisito ok={/[a-zA-Z]/.test(senha) && /\d/.test(senha)} opcional>
                    Letras e números (recomendado)
                  </Requisito>
                </ul>
              ) : null
            }
          />
          <Aviso tipo="erro">{erro}</Aviso>
          <BotaoEnviar carregando={carregando} textoCarregando={criando ? "Criando conta…" : "Entrando…"}>
            {criando ? "Criar conta" : "Entrar"}
          </BotaoEnviar>
        </form>

        <p className="auth-some-teclado text-center text-sm text-[#8fa9a2]">
          {criando ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
          <LinkAuth onClick={() => irPara(criando ? "entrar" : "criar")}>{criando ? "Entrar" : "Criar agora"}</LinkAuth>
        </p>
      </div>
    </LayoutAuth>
  );
}

function Requisito({ ok, opcional, children }) {
  return (
    <li className={"flex items-center gap-2 " + (ok ? "text-[#3ee0a8]" : opcional ? "text-[#7f9a93]" : "text-[#9fb8b1]")}>
      {ok ? <Check size={15} aria-hidden /> : <Circle size={13} aria-hidden />}
      <span>
        {children}
        <span className="sr-only">{ok ? " — cumprido" : " — pendente"}</span>
      </span>
    </li>
  );
}

// Tela que aparece DEPOIS de clicar no link de "Esqueci a senha": a pessoa
// digita a senha nova (a sessão de recuperação já está ativa). Ao salvar,
// a senha é gravada e o app segue para dentro.
export function TelaNovaSenha({ onPronto }) {
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [ok, setOk] = useState(false);

  const erroSenha = tentou && senha.length < 8 ? "A senha precisa ter pelo menos 8 caracteres." : null;
  const erroConf = tentou && !erroSenha && senha !== conf ? "As duas senhas precisam ser iguais." : null;

  async function salvar(e) {
    e.preventDefault();
    if (carregando) return;
    setTentou(true);
    setErro("");
    if (senha.length < 8 || senha !== conf) return;
    setCarregando(true);
    try {
      await atualizarSenha(senha);
      setOk(true);
      setTimeout(() => onPronto?.(), 1200);
    } catch (err) {
      setErro(mensagemErroAuth(err, "novaSenha"));
      setCarregando(false);
    }
  }

  return (
    <LayoutAuth titulo="Criar senha nova" subtitulo="Escolha a senha que você vai usar para entrar.">
      {ok ? (
        <div className="pb-6">
          <Aviso tipo="ok">Senha salva! Entrando…</Aviso>
        </div>
      ) : (
        <form onSubmit={salvar} className="space-y-4" noValidate>
          {/* campo escondido para o gerenciador de senhas associar a conta */}
          <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden readOnly />
          <CampoSenha
            id="nova-senha"
            rotulo="Nova senha"
            name="new-password"
            autoComplete="new-password"
            enterKeyHint="next"
            placeholder="Pelo menos 8 caracteres"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erroSenha}
          />
          <CampoSenha
            id="nova-senha-conf"
            rotulo="Repita a nova senha"
            name="confirm-password"
            autoComplete="new-password"
            enterKeyHint="done"
            value={conf}
            onChange={(e) => setConf(e.target.value)}
            erro={erroConf}
          />
          <Aviso tipo="erro">{erro}</Aviso>
          <BotaoEnviar carregando={carregando} textoCarregando="Salvando…">
            Salvar senha
          </BotaoEnviar>
        </form>
      )}
    </LayoutAuth>
  );
}

