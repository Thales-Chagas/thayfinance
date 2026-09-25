import React, { useState, useEffect, useRef } from "react";
import emblemaUrl from "./emblema.png";
import { User, Briefcase, ChevronLeft, ChevronDown, Download, Upload, Check, Loader2, Cloud, CloudOff, Moon, Sun, LogOut, Camera, ScanFace, Send, Plus, Home, ListOrdered, CalendarClock, LayoutGrid } from "lucide-react";
import { definirNomeNuvem, sairNuvem, sessaoAtual, aoMudarAuth, marcarLoginNuvem, limparLoginNuvem, loginNuvemTs } from "./cloudAuth";
import { carregarTudo, sincronizar, migrarLocalParaNuvem } from "./cloudData";
import { temAutenticadorPlataforma, registrarBiometria, verificarBiometria } from "./biometria";
import { STORAGE_KEY, LOGIN_KEY, loginKey, TEMA_KEY, MIGR_KEY, URL_RECUPERACAO, NUVEM_MS, marcarDesbloqueio, limparDesbloqueio, desbloqueioRecente, TOUR_KEY } from "./lib/constantes";
import { uid, fmtBRL, somaDias, soma } from "./lib/formato";
import { desfazerMudanca } from "./lib/transacoes";
import { menorData, gerarProximasOcorrencias, estenderRecorrencias } from "./lib/recorrencia";
import { SEED, espacoVazio, dadosVazios, normalizarDados } from "./lib/dados";
import { storageGet, storageSet, hashPin } from "./lib/armazenamento";
import { serializarBackup, lerBackup, nomeArquivoBackup } from "./lib/backup";
import { useConfirmar } from "./components/Confirmar";
import { useTecladoVirtual } from "./components/Sheet";
import { Toast } from "./components/Toast";
import { gradientePorNome } from "./lib/cores";
import { CropFotoModal } from "./components/CropFotoModal";
import { PaginaLancamentos } from "./paginas/PaginaLancamentos";
import { PaginaInicio } from "./paginas/PaginaInicio";
import { PaginaMais } from "./paginas/PaginaMais";
import { FormTransacao } from "./components/FormTransacao";
import { SeletorMes } from "./components/SeletorMes";
import { Sheet } from "./components/Sheet";
import { PaginaContas } from "./paginas/PaginaContas";
import { PaginaFluxo } from "./paginas/PaginaFluxo";
import { PaginaMetas } from "./paginas/PaginaMetas";
import { PaginaCategorias } from "./paginas/PaginaCategorias";
import { PaginaCadastro } from "./paginas/PaginaCadastro";
import { PaginaRelatorios } from "./paginas/PaginaRelatorios";
import { TelaAuth, TelaNovaSenha } from "./telas/TelaAuth";
import { TelaLogin } from "./telas/TelaLogin";
import { NAV_PESSOAL, NAV_EMPRESA, DENTRO_DE_MAIS, abaDe, USA_MES, TITULOS } from "./lib/navegacao";
import { PaginaConta } from "./paginas/PaginaConta";
import { ModalConectarTelegram } from "./components/ModalConectarTelegram";
import { TourBoasVindas } from "./components/TourBoasVindas";

export default function App() {
  const [data, setData] = useState(dadosVazios);
  const [modo, setModo] = useState("pessoal"); // pessoal | empresarial
  const [view, setView] = useState("dashboard");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesIdx, setMesIdx] = useState(new Date().getMonth());
  const [status, setStatus] = useState("idle");
  const [toast, setToast] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [login, setLogin] = useState(null);
  const [auth, setAuth] = useState("init");
  const [sessao, setSessao] = useState(null); // sessão da nuvem (Supabase Auth)
  const [userId, setUserId] = useState(null);
  const [nuvemPronta, setNuvemPronta] = useState(false);
  const ultimoSyncRef = useRef(null);   // último estado que já está na nuvem (base do diff)
  const modoNuvemRef = useRef(false);   // true quando os dados vêm/vão pra nuvem
  const ultimoUidRef = useRef(null);    // conta cuja trava local já foi resolvida (p/ detectar troca)
  const [escuro, setEscuro] = useState(() => {
    try {
      return localStorage.getItem(TEMA_KEY) === "escuro";
    } catch {
      return false;
    }
  });
  const [arquivoFoto, setArquivoFoto] = useState(null);
  const [bioDisponivel, setBioDisponivel] = useState(false);
  const [mostrarTelegram, setMostrarTelegram] = useState(false);
  const [mostrarTour, setMostrarTour] = useState(false);
  const dirtyRef = useRef(false);
  const toastTimer = useRef(null);
  const toastRef = useRef(null);
  const [tentativa, setTentativa] = useState(0); // nova tentativa de envio à nuvem
  const confirmar = useConfirmar();
  useTecladoVirtual();
  const fileRef = useRef(null);
  const fotoTrocaRef = useRef(null);

  // Aplica o tema escuro/claro
  useEffect(() => {
    document.documentElement.classList.toggle("dark", escuro);
    try {
      localStorage.setItem(TEMA_KEY, escuro ? "escuro" : "claro");
    } catch {
      /* sem armazenamento */
    }
  }, [escuro]);

  // Decide a tela de entrada quando JÁ existe sessão na nuvem:
  // se este aparelho tem tranca rápida (PIN/biometria) E já passou 1h desde o
  // último desbloqueio, pede o PIN; senão (dentro de 1h), abre direto.
  function estadoComSessao(conf) {
    const precisaTranca = conf?.pinHash && (conf.pedirSempre || conf.bioCredId);
    // Janela de 1h: recarregar OU reabrir dentro de 1h não repede a tranca.
    const graca = desbloqueioRecente();
    if (precisaTranca && !graca) return "lock";
    return "open";
  }

  // Resolve a trava local (PIN/foto/nome) DA CONTA logada na nuvem e atualiza o
  // estado `login`. Cada conta tem sua trava (chave por uid). Se a única trava
  // for a antiga (device-global, sem dono) e o nome bater com o da conta, ela é
  // adotada por essa conta — preserva o PIN/foto de quem já usava o aparelho,
  // sem entregá-los a uma conta diferente. O nome exibido segue a nuvem (fonte
  // da verdade). Troca de conta zera a janela de 1h (re-pede a tranca da nova).
  async function resolverLogin(sess) {
    const uid = sess?.user?.id ?? null;
    const nomeNuvem = (sess?.user?.user_metadata?.nome || "").trim();

    let raw = await storageGet(loginKey(uid));
    let conf = raw ? JSON.parse(raw) : null;

    if (!conf && uid) {
      const rawLegado = await storageGet(LOGIN_KEY);
      const legado = rawLegado ? JSON.parse(rawLegado) : null;
      if (legado) {
        const nomeLegado = (legado.nome || "").trim();
        // Adota a trava antiga (sem dono) quando o nome bate com o da conta OU
        // quando a conta ainda não tem nome na nuvem (a trava local é a melhor
        // identidade). Conta com nome DIFERENTE nunca herda (evita o bug de uma
        // conta pegar o PIN/foto da outra).
        const daPessoa =
          !nomeNuvem || (nomeLegado && nomeLegado.toLowerCase() === nomeNuvem.toLowerCase());
        if (daPessoa) {
          conf = { ...legado, uid };
          await storageSet(loginKey(uid), JSON.stringify(conf)); // migra p/ a conta
          await storageSet(LOGIN_KEY, ""); // consome a antiga (não vaza p/ outra conta)
          // Conta sem nome na nuvem → grava o nome lá p/ aparecer em outros
          // aparelhos também (best-effort, não bloqueia).
          if (!nomeNuvem && nomeLegado) definirNomeNuvem(nomeLegado);
        }
      }
    }

    // Trocou de conta neste aparelho → não reaproveita a janela de 1h.
    if (uid && ultimoUidRef.current && uid !== ultimoUidRef.current) limparDesbloqueio();
    ultimoUidRef.current = uid;

    // Identidade exibida: PIN/foto vêm da trava desta conta; nome prioriza a nuvem.
    if (conf?.pinHash) setLogin(nomeNuvem ? { ...conf, nome: nomeNuvem } : conf);
    else if (nomeNuvem) setLogin({ nome: nomeNuvem, foto: conf?.foto ?? null });
    else setLogin(conf);

    return conf;
  }

  // Carrega dados salvos ao abrir
  useEffect(() => {
    (async () => {
      try {
        const sess = await sessaoAtual();
        setSessao(sess);
        setUserId(sess?.user?.id ?? null);
        const conf = await resolverLogin(sess); // trava local DA conta logada
        // Aberto por link de "Esqueci a senha" → tela de senha nova (mesmo
        // que já exista sessão de recuperação, NÃO entrar direto).
        // Sem sessão na nuvem → portão externo (entrar/criar conta).
        // Com sessão → tranca rápida deste aparelho (ou abre direto).
        if (URL_RECUPERACAO) {
          setAuth("recuperar");
        } else if (!sess) {
          setAuth("auth"); // sem sessão → portão externo (entrar/criar conta)
        } else {
          // Tem sessão. Ela só vale por 24h: passou disso → repede o login.
          let ts = loginNuvemTs();
          if (!ts) {
            // sessão que já existia antes desta regra → começa a contar agora
            marcarLoginNuvem();
            ts = Date.now();
          }
          if (Date.now() - ts >= NUVEM_MS) {
            sairNuvem().catch(() => {}); // encerra a sessão antiga
            limparLoginNuvem();
            setSessao(null);
            setUserId(null);
            setAuth("auth");
          } else {
            setAuth(estadoComSessao(conf)); // dentro das 24h → PIN (se >1h) ou abre
          }
        }
      } catch {
        setAuth(URL_RECUPERACAO ? "recuperar" : "auth");
      }
      try {
        const raw = await storageGet(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const dados = normalizarDados(parsed) || normalizarDados(SEED) || dadosVazios();
        // se migramos do formato antigo, regrava já no novo
        if (parsed && parsed.versao !== 2) dirtyRef.current = true;
        setData(dados);
      } catch {
        showToast("Não foi possível carregar os dados salvos.", true);
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-salvamento com debounce de 800ms.
  // Sempre guarda um backup local; se estiver logado na nuvem, também
  // sincroniza as diferenças (novos/alterados/excluídos) com o Supabase.
  useEffect(() => {
    if (!loaded || !dirtyRef.current) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      const okLocal = await storageSet(STORAGE_KEY, JSON.stringify(data)); // backup local
      if (modoNuvemRef.current && nuvemPronta && userId) {
        try {
          await sincronizar(userId, ultimoSyncRef.current, data);
          ultimoSyncRef.current = data;
          setStatus("saved");
          avisoDeFundo("Salvo na nuvem ✓");
        } catch (e) {
          console.error("erro ao sincronizar com a nuvem:", e);
          setStatus("error");
          avisoDeFundo("Sem conexão com a nuvem. Guardei no aparelho e envio quando a internet voltar.", true);
          // não atualiza ultimoSyncRef → tenta de novo ao reconectar ou na próxima mudança
        }
      } else if (okLocal) {
        setStatus("saved");
        avisoDeFundo("Salvo ✓");
      } else {
        setStatus("error");
        showToast("Erro ao salvar. Tente novamente.", true);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loaded, nuvemPronta, userId, tentativa]);

  // Falhou o envio pra nuvem? Tenta de novo quando a internet volta ou quando
  // o app volta a ficar visível. Os dados já estão guardados no aparelho.
  useEffect(() => {
    if (status !== "error") return;
    const tentar = () => {
      if (navigator.onLine !== false && document.visibilityState === "visible") {
        dirtyRef.current = true;
        setTentativa((n) => n + 1);
      }
    };
    window.addEventListener("online", tentar);
    document.addEventListener("visibilitychange", tentar);
    return () => {
      window.removeEventListener("online", tentar);
      document.removeEventListener("visibilitychange", tentar);
    };
  }, [status]);

  // acao = { rotulo, fn } mostra um botão no aviso (ex.: "Desfazer")
  function showToast(msg, isError = false, ms = 1800, acao = null) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const t = { id: Date.now(), msg, isError, acao };
    toastRef.current = t;
    setToast(t);
    toastTimer.current = setTimeout(() => {
      toastRef.current = null;
      setToast(null);
    }, acao ? Math.max(ms, 5000) : ms);
  }
  function fecharToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastRef.current = null;
    setToast(null);
  }
  // Avisos automáticos (salvamento) não apagam um aviso com "Desfazer".
  function avisoDeFundo(msg, isError = false) {
    if (toastRef.current?.acao && !isError) return;
    showToast(msg, isError, isError ? 5000 : 1800);
  }

  // Renova as recorrências sem término: ao abrir o app (com os dados certos já
  // carregados — nuvem, se logado), garante os próximos 12 meses programados.
  // Ids determinísticos ⇒ rodar em outro aparelho não duplica parcela.
  const recorrenciasRenovadasRef = useRef(false);
  useEffect(() => {
    if (!loaded || auth !== "open" || recorrenciasRenovadasRef.current) return;
    if (userId && !nuvemPronta) return; // espera os dados da nuvem chegarem
    recorrenciasRenovadasRef.current = true;
    setData((prev) => {
      let mudou = false;
      const prox = { ...prev };
      for (const m of ["pessoal", "empresarial"]) {
        const extras = estenderRecorrencias(prev[m].transacoes);
        if (extras.length) {
          mudou = true;
          prox[m] = { ...prev[m], transacoes: [...prev[m].transacoes, ...extras] };
        }
      }
      if (!mudou) return prev;
      dirtyRef.current = true;
      return prox;
    });
  }, [loaded, auth, nuvemPronta, userId]);

  const espaco = data[modo];
  const empresarial = modo === "empresarial";
  const NAV = empresarial ? NAV_EMPRESA : NAV_PESSOAL;

  function atualizarEspaco(fn) {
    dirtyRef.current = true;
    setData((prev) => ({ ...prev, [modo]: fn(prev[modo]) }));
  }

  // Apaga TODOS os dados de um espaço (pessoal OU empresarial) e devolve as
  // categorias ao padrão. O auto-save cuida do resto (backup local + nuvem).
  function limparEspaco(modoAlvo) {
    dirtyRef.current = true;
    setData((prev) => ({ ...prev, [modoAlvo]: espacoVazio(modoAlvo) }));
  }

  // Aplica uma mudança nos lançamentos do espaço atual e oferece "Desfazer".
  // `fn` precisa ser pura (ids gerados ANTES), porque o React pode chamá-la
  // duas vezes; o registro guarda o antes/depois para desfazer por id.
  function mudarTransacoes(fn, mensagem) {
    const reg = { modo };
    atualizarEspaco((esp) => {
      const novo = fn(esp);
      reg.antes = esp.transacoes;
      reg.depois = novo.transacoes;
      return novo;
    });
    if (mensagem) {
      showToast(mensagem, false, 5000, {
        rotulo: "Desfazer",
        fn: () => {
          if (!reg.antes) return;
          dirtyRef.current = true;
          setData((prev) => ({
            ...prev,
            [reg.modo]: { ...prev[reg.modo], transacoes: desfazerMudanca(prev[reg.modo].transacoes, reg.antes, reg.depois) },
          }));
          showToast("Desfeito");
        },
      });
    }
  }

  const acharTx = (id) => data[modo].transacoes.find((x) => x.id === id);
  const nomeTipo = (t) => (t?.tipo === "receita" ? (empresarial ? "Entrada" : "Receita") : "Despesa");

  const acoesTransacao = {
    // Salva o lançamento e cuida da recorrência:
    //  regra === undefined → não mexe na série (edição sem tocar na repetição)
    //  regra === null      → repetição desligada (encerra a série, se havia)
    //  regra = {tipo,cada,fim} → (re)programa a série a partir deste lançamento
    salvar: (t, regra, info = {}) => {
      const id = t.id || uid();
      const grupoNovo = uid();
      const jaExiste = !!acharTx(id);
      mudarTransacoes(
        (esp) => {
          const anterior = esp.transacoes.find((x) => x.id === id) || null;
          let base = { ...t, id };
          let ts = anterior ? esp.transacoes.map((x) => (x.id === base.id ? base : x)) : [...esp.transacoes, base];
          if (regra === undefined) return { ...esp, transacoes: ts };

          const grupoAntigo = anterior?.recorrencia?.grupo;
          if (grupoAntigo) {
            // a regra mudou (ou foi desligada): some com as próximas pendentes da
            // série antiga e encerra a regra nas que ficam (pra não renascerem)
            ts = ts
              .filter(
                (x) => !(x.recorrencia?.grupo === grupoAntigo && x.id !== base.id && x.status === "pendente" && x.data > base.data)
              )
              .map((x) =>
                x.id !== base.id && x.recorrencia?.grupo === grupoAntigo
                  ? { ...x, recorrencia: { ...x.recorrencia, fim: menorData(x.recorrencia.fim, somaDias(base.data, -1)) } }
                  : x
              );
          }
          if (regra) {
            // série nova (mesmo numa edição: grupo novo daqui em diante,
            // as parcelas antigas guardam a história com a regra encerrada)
            const r = { grupo: grupoNovo, tipo: regra.tipo, cada: regra.cada ?? null, inicio: base.data, fim: regra.fim ?? null, n: 0 };
            base = { ...base, recorrencia: r };
            ts = ts.map((x) => (x.id === base.id ? base : x));
            const ids = new Set(ts.map((x) => x.id));
            ts = [...ts, ...gerarProximasOcorrencias(base, r, 1, ids)];
          } else if (base.recorrencia) {
            const { recorrencia: _r, ...semRec } = base;
            ts = ts.map((x) => (x.id === base.id ? semRec : x));
          }
          return { ...esp, transacoes: ts };
        },
        jaExiste && !info.novo ? "Alterações salvas" : `${nomeTipo(t)} salva · ${fmtBRL(t.valor)}`
      );
    },
    // Exclui UMA conta. Se era a última programada de uma série sem término,
    // encerra a série ali — senão o app recriaria a parcela sozinho depois.
    excluir: (id) =>
      mudarTransacoes((esp) => {
        const alvo = esp.transacoes.find((x) => x.id === id);
        const g = alvo?.recorrencia?.grupo;
        let ts = esp.transacoes.filter((x) => x.id !== id);
        if (g) {
          const doGrupo = esp.transacoes.filter((x) => x.recorrencia?.grupo === g);
          const maxN = Math.max(...doGrupo.map((x) => x.recorrencia.n ?? 0));
          if ((alvo.recorrencia.n ?? 0) === maxN) {
            ts = ts.map((x) =>
              x.recorrencia?.grupo === g
                ? { ...x, recorrencia: { ...x.recorrencia, fim: menorData(x.recorrencia.fim, somaDias(alvo.data, -1)) } }
                : x
            );
          }
        }
        return { ...esp, transacoes: ts };
      }, "Lançamento excluído"),
    // Exclui a conta E todas as próximas da mesma série (as pagas ficam).
    excluirSerie: (id) =>
      mudarTransacoes((esp) => {
        const alvo = esp.transacoes.find((x) => x.id === id);
        const g = alvo?.recorrencia?.grupo;
        if (!g) return { ...esp, transacoes: esp.transacoes.filter((x) => x.id !== id) };
        return {
          ...esp,
          transacoes: esp.transacoes
            .filter((x) => x.id !== id && !(x.recorrencia?.grupo === g && x.status === "pendente" && x.data >= alvo.data))
            .map((x) =>
              x.recorrencia?.grupo === g
                ? { ...x, recorrencia: { ...x.recorrencia, fim: menorData(x.recorrencia.fim, somaDias(alvo.data, -1)) } }
                : x
            ),
        };
      }, "Esta e as próximas foram excluídas"),
    marcarOk: (id) => {
      const t = acharTx(id);
      mudarTransacoes(
        (esp) => ({ ...esp, transacoes: esp.transacoes.map((x) => (x.id === id ? { ...x, status: "ok" } : x)) }),
        t?.tipo === "receita" ? "Marcado como recebido" : "Marcado como pago"
      );
    },
    marcarPendente: (id) => {
      const t = acharTx(id);
      mudarTransacoes(
        (esp) => ({ ...esp, transacoes: esp.transacoes.map((x) => (x.id === id ? { ...x, status: "pendente" } : x)) }),
        t?.tipo === "receita" ? "Voltou para a receber" : "Voltou para a pagar"
      );
    },
    // Cria uma categoria no espaço ATUAL (modo pessoal/empresarial vigente) e
    // devolve o objeto {id,nome,cor}. Fica salva só neste login (via user_id na
    // nuvem) e só neste tipo (coluna modo). Se já existir pelo nome, reaproveita.
    criarCategoria: (nome, cor) => {
      const limpo = (nome || "").trim();
      if (!limpo) return null;
      const existente = data[modo].categorias.find((c) => c.nome.toLowerCase() === limpo.toLowerCase());
      if (existente) return existente;
      const nova = { id: uid(), nome: limpo, cor: cor || gradientePorNome(limpo).id };
      atualizarEspaco((esp) => ({ ...esp, categorias: [...esp.categorias, nova] }));
      return nova;
    },
  };

  // Painel de lançamento (global: o "+" abre de qualquer tela)
  const [lancamento, setLancamento] = useState(null); // null | { tipo, inicial, statusPadrao }
  const abrirLancamento = (opts = {}) => setLancamento({ tipo: "despesa", ...opts, chave: Date.now() });

  // ---- Navegação com histórico (o "voltar" do celular volta de tela) ----
  const [filtroLanc, setFiltroLanc] = useState("tudo");
  const [escolhendoModo, setEscolhendoModo] = useState(false);
  function irPara(v) {
    if (v === "receitas" || v === "despesas") {
      setFiltroLanc(v === "receitas" ? "receita" : "despesa");
      v = "lancamentos";
    } else if (v === "lancamentos") setFiltroLanc("tudo");
    if (v === view) return;
    try {
      window.history.pushState({ tfView: v }, "");
    } catch {
      /* sem histórico */
    }
    setView(v);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    try {
      window.history.replaceState({ ...(window.history.state || {}), tfView: "dashboard" }, "");
    } catch {
      /* ignora */
    }
    const aoVoltar = (e) => {
      setView(e.state?.tfView || "dashboard");
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);

  function trocarModo(novoModo) {
    setEscolhendoModo(false);
    if (novoModo === modo) return;
    setModo(novoModo);
    if (view !== "mais") setView("dashboard");
    showToast(novoModo === "empresarial" ? "Espaço empresarial" : "Espaço pessoal");
  }

  async function sairComConfirmacao() {
    const ok = await confirmar({
      titulo: "Sair da conta?",
      mensagem: "No próximo acesso vão ser pedidos o e-mail e a senha. Seus dados continuam guardados na nuvem.",
      confirmar: "Sair",
      perigo: true,
    });
    if (ok) sair();
  }

  /* ---- login / foto / sair ---- */
  async function criarLogin(nome, pin, pedirSempre, foto) {
    const salt = Math.random().toString(36).slice(2, 12);
    const conf = { nome, salt, pinHash: await hashPin(pin, salt), pedirSempre, foto: foto || null, uid: userId };
    await storageSet(loginKey(userId), JSON.stringify(conf));
    ultimoUidRef.current = userId;
    setLogin(conf);
    setAuth("open");
    showToast(`Tudo pronto, ${nome}! ✓`);
  }

  async function desbloquear(pin) {
    if (!login) return false;
    const ok = (await hashPin(pin, login.salt)) === login.pinHash;
    if (ok) setAuth("open");
    return ok;
  }

  async function esqueciPin() {
    const ok = await confirmar({
      titulo: "Redefinir o PIN?",
      mensagem: "Seus dados financeiros NÃO serão apagados — você só vai criar um novo PIN.",
      confirmar: "Redefinir PIN",
    });
    if (!ok) return;
    await storageSet(loginKey(userId), "");
    setLogin(null);
    setAuth("setup");
  }

  async function sair() {
    // Logout de verdade: encerra a sessão na nuvem e volta pro portão.
    try {
      await sairNuvem();
    } catch {
      /* segue mesmo se a rede falhar */
    }
    limparDesbloqueio(); // "Sair" encerra a janela de 1h → pede tranca no próximo acesso
    limparLoginNuvem();  // e zera o contador de 24h → pede e-mail/senha de novo
    setSessao(null);
    setUserId(null);
    setNuvemPronta(false);
    modoNuvemRef.current = false;
    ultimoSyncRef.current = null;
    setAuth("auth");
  }

  // Verifica, ao abrir, se o aparelho tem Face ID / digital
  useEffect(() => {
    temAutenticadorPlataforma().then(setBioDisponivel);
  }, []);

  // Renova a janela de 1h enquanto o app está aberto (assim recarregar não pede tranca)
  useEffect(() => {
    if (auth === "open") marcarDesbloqueio();
  }, [auth]);

  // Tour de boas-vindas: 1ª vez que o app abre desbloqueado neste aparelho
  // (depois dos dados carregados, pra não brigar com a pergunta de migração).
  useEffect(() => {
    if (auth !== "open" || !loaded) return;
    (async () => {
      try {
        const visto = await storageGet(TOUR_KEY);
        if (visto !== "1") setMostrarTour(true);
      } catch {
        /* sem armazenamento: não mostra */
      }
    })();
  }, [auth, loaded]);

  function fecharTour() {
    setMostrarTour(false);
    storageSet(TOUR_KEY, "1");
  }

  // Espelha `auth` num ref, pra o observador da nuvem (deps []) saber se
  // estamos no portão de login sem virar dependência do efeito.
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  // Observa login/logout na nuvem (ex.: logo após entrar pela TelaAuth,
  // ou quando a sessão expira/é encerrada em outra aba).
  useEffect(() => {
    const parar = aoMudarAuth((sess, evento) => {
      setSessao(sess);
      setUserId(sess?.user?.id ?? null);
      // Chegou pelo link de "Esqueci a senha" → força a tela de senha nova.
      if (evento === "PASSWORD_RECOVERY") return setAuth("recuperar");
      // A restauração da sessão ao abrir (INITIAL_SESSION) e o refresh de token
      // NÃO decidem a tela: quem decide o estado inicial é a carga (com a regra
      // das 24h). Aqui só reagimos a um login FEITO na tela de entrada
      // (auth === "auth") ou a um logout — assim nada fura a checagem de 24h.
      if (evento === "INITIAL_SESSION") return;
      if (!sess) {
        setLogin(null); // logout → limpa nome/foto na saudação
        return setAuth("auth");
      }
      // Login feito no portão: resolve a trava DESTA conta (nome/foto/PIN certos)
      // e só então decide entre pedir o PIN (lock) ou abrir.
      if (authRef.current === "auth") {
        resolverLogin(sess).then((conf) => setAuth(estadoComSessao(conf)));
      }
    });
    return parar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao abrir logado, carrega os dados da NUVEM. No 1º acesso deste aparelho,
  // se houver dados locais ainda não enviados, pergunta se quer subir (migração).
  useEffect(() => {
    if (auth !== "open" || !userId || nuvemPronta) return;
    (async () => {
      try {
        const dadosNuvem = await carregarTudo();

        // dados guardados neste aparelho (localStorage)
        let locais = null;
        try {
          const raw = await storageGet(STORAGE_KEY);
          locais = raw ? normalizarDados(JSON.parse(raw)) : null;
        } catch {
          /* ignora */
        }
        const txLocais = locais
          ? (locais.pessoal.transacoes.length + locais.empresarial.transacoes.length)
          : 0;
        const jaMigrou = (await storageGet(MIGR_KEY + userId)) === "1";

        if (txLocais > 0 && !jaMigrou) {
          const ok = await confirmar({
            titulo: "Enviar os dados deste aparelho?",
            mensagem:
              "Encontramos lançamentos guardados neste aparelho. Deseja enviá-los para a sua conta na nuvem?\n\nNada será apagado — eles ficam junto com o que você lançou pelo robô do Telegram.",
            confirmar: "Enviar para a nuvem",
            cancelar: "Agora não",
          });
          if (ok) {
            // passa os dados da nuvem p/ casar categorias por nome (não duplicar)
            const res = await migrarLocalParaNuvem(userId, locais, dadosNuvem);
            const merge = await carregarTudo(); // recarrega já com tudo junto
            setData(merge);
            ultimoSyncRef.current = merge;
            await storageSet(MIGR_KEY + userId, "1"); // só marca se enviou de verdade
            showToast(`${res.transacoes} lançamentos enviados para a nuvem ✓`);
          } else {
            // recusou: NÃO marca como migrado (pergunta de novo depois, pra não sumir dado)
            setData(dadosNuvem);
            ultimoSyncRef.current = dadosNuvem;
          }
        } else {
          setData(dadosNuvem);
          ultimoSyncRef.current = dadosNuvem;
        }

        dirtyRef.current = false; // o setData acima não deve disparar gravação
        modoNuvemRef.current = true;
        setNuvemPronta(true);
      } catch (e) {
        console.error("falha ao carregar da nuvem:", e);
        showToast("Não consegui carregar da nuvem agora. Usando os dados do aparelho.", true);
        modoNuvemRef.current = false; // segue no modo local (dados já carregados)
        setNuvemPronta(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, userId, nuvemPronta]);

  async function ativarBiometria() {
    if (!login) return;
    try {
      const credId = await registrarBiometria(login.nome);
      const conf = { ...login, bioCredId: credId, uid: userId };
      setLogin(conf);
      await storageSet(loginKey(userId), JSON.stringify(conf));
      showToast("Face ID / digital ativado ✓");
    } catch {
      showToast("Não consegui ativar a biometria neste aparelho.", true);
    }
  }

  async function desativarBiometria() {
    if (!login) return;
    const conf = { ...login, uid: userId };
    delete conf.bioCredId;
    setLogin(conf);
    await storageSet(loginKey(userId), JSON.stringify(conf));
    showToast("Biometria desativada.");
  }

  async function desbloquearBiometria() {
    if (!login?.bioCredId) return false;
    try {
      await verificarBiometria(login.bioCredId);
      setAuth("open");
      return true;
    } catch {
      return false;
    }
  }

  async function salvarFoto(dataUrl) {
    if (!login) return;
    const conf = { ...login, foto: dataUrl, uid: userId };
    setLogin(conf);
    setArquivoFoto(null);
    await storageSet(loginKey(userId), JSON.stringify(conf));
    showToast("Foto atualizada ✓");
  }

  /* ---- backup ---- */
  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      // 1) ler + reconhecer o arquivo (erros separados p/ diagnóstico)
      let dados;
      try {
        dados = lerBackup(reader.result);
      } catch (e) {
        console.error("JSON inválido no backup:", e);
        return showToast("O arquivo não é um JSON válido. Exporte de novo pelo app.", true, 6000);
      }
      if (!dados) return showToast("Estrutura do backup não reconhecida. Exporte de novo pelo app.", true, 6000);

      // 2) aplicar
      if (modoNuvemRef.current && userId) {
        // Logado na nuvem: SOMA o backup à conta com dedupe (categorias
        // iguais por nome não duplicam), em vez de substituir o aparelho.
        const ok = await confirmar({
          titulo: "Enviar este backup?",
          mensagem: "Ele será somado ao que já existe na sua conta — categorias com o mesmo nome não duplicam, e nada é apagado.",
          confirmar: "Enviar backup",
        });
        if (!ok) return;
        setStatus("saving");
        try {
          const res = await migrarLocalParaNuvem(userId, dados, data);
          const merge = await carregarTudo();
          dirtyRef.current = false; // o setData abaixo não deve disparar nova gravação
          setData(merge);
          ultimoSyncRef.current = merge;
          setStatus("saved");
          showToast(`${res.transacoes} lançamentos enviados para a nuvem ✓`);
        } catch (e) {
          console.error("falha ao enviar backup pra nuvem:", e);
          setStatus("error");
          const detalhe = e?.message || e?.error_description || e?.details || String(e);
          showToast("A nuvem recusou o envio: " + detalhe, true, 12000);
        }
      } else {
        const ok = await confirmar({
          titulo: "Importar este backup?",
          mensagem: "Os dados atuais deste aparelho serão substituídos pelos do arquivo.",
          confirmar: "Substituir e importar",
          perigo: true,
        });
        if (!ok) return;
        dirtyRef.current = true;
        setData(dados);
        showToast("Backup importado ✓");
      }
    };
    reader.onerror = () => showToast("Não foi possível ler o arquivo.", true);
    reader.readAsText(file);
  }

  function exportData() {
    const blob = new Blob([serializarBackup(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivoBackup();
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup exportado ✓");
  }

  function mudarMes(y, mi) {
    setAno(y);
    setMesIdx(mi);
  }

  const usaMes = USA_MES.includes(view);

  // Saudação com o nome da pessoa logada; a marca do app é fixa
  const nomeApp = "Thayfinance";
  const saudacao = login?.nome ? `Olá, ${login.nome.trim().split(/\s+/)[0]}` : nomeApp;

  useEffect(() => {
    document.title = `${nomeApp} — Controle financeiro`;
  }, []);

  if (auth === "init") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 dark:text-slate-400 dark:bg-slate-950">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (auth === "auth") {
    return <TelaAuth />;
  }

  if (auth === "recuperar") {
    return (
      <TelaNovaSenha
        onPronto={() => {
          // Senha gravada; a sessão já é válida. Limpa o hash da URL pra um
          // refresh não reabrir a tela, e segue pro app.
          try {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          } catch {
            /* ignora */
          }
          setAuth(estadoComSessao(login));
        }}
      />
    );
  }

  if (auth === "setup" || auth === "lock") {
    return (
      <TelaLogin
        modo={auth}
        nome={login?.nome}
        foto={login?.foto}
        onCriar={criarLogin}
        onDesbloquear={desbloquear}
        onEsqueci={esqueciPin}
        onBiometria={desbloquearBiometria}
        temBio={!!login?.bioCredId}
        escuro={escuro}
        onTema={() => setEscuro((e) => !e)}
      />
    );
  }

  const aba = abaDe(view);
  const dentroDeMais = DENTRO_DE_MAIS.includes(view);
  const nomeEspaco = empresarial ? "Empresarial" : "Pessoal";

  // indicador de salvamento (ícone discreto no topo)
  const statusIcone =
    status === "saving" ? (
      <Loader2 size={18} className="animate-spin text-amber-600" />
    ) : status === "error" ? (
      <CloudOff size={18} className="text-red-600" />
    ) : status === "saved" ? (
      <Check size={18} className="text-emerald-600" />
    ) : (
      <Cloud size={18} className="text-slate-400" />
    );
  const statusTexto =
    status === "saving" ? "Salvando…" : status === "error" ? "Sem conexão — guardado no aparelho" : status === "saved" ? "Tudo salvo" : "Pronto";

  const seletorModo = (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Espaço">
      {[
        ["pessoal", "Pessoal", User],
        ["empresarial", "Empresarial", Briefcase],
      ].map(([v, r, Icon]) => (
        <button
          key={v}
          role="radio"
          aria-checked={modo === v}
          onClick={() => trocarModo(v)}
          className={
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition " +
            (modo === v
              ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
              : "text-slate-500 dark:text-slate-400")
          }
        >
          <Icon size={14} /> {r}
        </button>
      ))}
    </div>
  );

  const ABAS = [
    { id: "dashboard", label: "Início", icon: Home },
    { id: "lancamentos", label: "Lançamentos", icon: ListOrdered },
    { id: "+" },
    { id: "contas", label: "Contas", icon: CalendarClock },
    { id: "mais", label: "Mais", icon: LayoutGrid },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Pular para o conteúdo
      </a>

      {/* Barra lateral — computador */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
          <img src={emblemaUrl} alt="" className="h-10 w-10 object-contain" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold leading-tight text-slate-800 dark:text-slate-100">{saudacao}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Controle financeiro</p>
          </div>
        </div>
        <div className="space-y-2 px-3 pb-3">
          {seletorModo}
          <button
            onClick={() => abrirLancamento({ tipo: "despesa" })}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Plus size={18} /> Novo lançamento
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Menu lateral">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => irPara(n.id)}
              aria-current={view === n.id ? "page" : undefined}
              className={
                "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition " +
                (view === n.id
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200")
              }
            >
              <n.icon size={17} />
              <span className="truncate">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="space-y-2 px-3 pb-5 pt-2">
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
            <button onClick={() => fotoTrocaRef.current?.click()} aria-label="Trocar foto" title="Trocar foto" className="shrink-0 transition hover:opacity-80">
              {login?.foto ? (
                <img src={login.foto} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Camera size={15} />
                </div>
              )}
            </button>
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{login?.nome}</p>
            <button
              onClick={sairComConfirmacao}
              aria-label="Sair"
              title="Sair"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400"
            >
              <LogOut size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={exportData}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Download size={14} /> Exportar
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Upload size={14} /> Importar
            </button>
          </div>
          {(bioDisponivel || userId) && (
            <div className="grid grid-cols-2 gap-2">
              {bioDisponivel && (
                <button
                  onClick={login?.bioCredId ? desativarBiometria : ativarBiometria}
                  className={
                    "flex h-9 items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition " +
                    (login?.bioCredId
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800")
                  }
                >
                  <ScanFace size={14} /> {login?.bioCredId ? "Face ID ativo" : "Face ID"}
                </button>
              )}
              {userId && (
                <button
                  onClick={() => setMostrarTelegram(true)}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                >
                  <Send size={14} /> Telegram
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="md:pl-64">
        <header className="safe-topo sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4">
            {dentroDeMais && (
              <button
                onClick={() => (window.history.state?.tfView === view ? window.history.back() : irPara("mais"))}
                className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
                aria-label="Voltar"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              {view === "dashboard" ? (
                <>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{saudacao}</p>
                  <button
                    onClick={() => setEscolhendoModo(true)}
                    className="-mx-1 -my-1.5 flex h-11 items-center gap-1 rounded-lg px-1 text-lg font-bold leading-none text-slate-800 dark:text-slate-100"
                    aria-label={`Espaço ${nomeEspaco}. Tocar para trocar`}
                  >
                    {nomeEspaco} <ChevronDown size={18} className="text-slate-400" />
                  </button>
                </>
              ) : (
                <>
                  <h1 className="truncate text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">{TITULOS[view]}</h1>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{nomeEspaco}</p>
                </>
              )}
            </div>
            {usaMes && <SeletorMes ano={ano} mesIdx={mesIdx} onMudar={mudarMes} />}
            <span className="flex h-11 w-8 shrink-0 items-center justify-center" title={statusTexto} role="img" aria-label={statusTexto}>
              {statusIcone}
            </span>
            <button
              onClick={() => setEscuro((e) => !e)}
              aria-label="Alternar tema claro/escuro"
              className="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex"
            >
              {escuro ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main id="conteudo" className="pb-barra mx-auto max-w-5xl px-4 pt-4">
          {!loaded ? (
            <div className="space-y-4" aria-busy="true" aria-label="Carregando seus dados">
              <div className="h-40 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800" />
              <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />
              <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />
            </div>
          ) : (
            <>
              {view === "dashboard" && (
                <PaginaInicio
                  espaco={espaco}
                  empresarial={empresarial}
                  ano={ano}
                  mesIdx={mesIdx}
                  escuro={escuro}
                  irPara={irPara}
                  acoes={acoesTransacao}
                  abrirLancamento={abrirLancamento}
                />
              )}
              {view === "lancamentos" && (
                <PaginaLancamentos
                  key={filtroLanc + modo}
                  espaco={espaco}
                  empresarial={empresarial}
                  ano={ano}
                  mesIdx={mesIdx}
                  acoes={acoesTransacao}
                  abrirLancamento={abrirLancamento}
                  filtroInicial={filtroLanc}
                />
              )}
              {view === "contas" && (
                <PaginaContas espaco={espaco} empresarial={empresarial} acoes={acoesTransacao} abrirLancamento={abrirLancamento} />
              )}
              {view === "fluxo" && <PaginaFluxo espaco={espaco} />}
              {view === "metas" && <PaginaMetas espaco={espaco} atualizar={atualizarEspaco} />}
              {view === "categorias" && <PaginaCategorias espaco={espaco} atualizar={atualizarEspaco} avisar={showToast} />}
              {view === "relatorios" && (
                <PaginaRelatorios espaco={espaco} empresarial={empresarial} ano={ano} mesIdx={mesIdx} nomeApp={nomeApp} />
              )}
              {view === "clientes" && empresarial && (
                <PaginaCadastro
                  titulo="Clientes"
                  singular="cliente"
                  itens={espaco.clientes}
                  comContato
                  atualizarLista={(fn) => atualizarEspaco((esp) => ({ ...esp, clientes: fn(esp.clientes) }))}
                />
              )}
              {view === "fornecedores" && empresarial && (
                <PaginaCadastro
                  titulo="Fornecedores"
                  singular="fornecedor"
                  itens={espaco.fornecedores}
                  comContato
                  atualizarLista={(fn) => atualizarEspaco((esp) => ({ ...esp, fornecedores: fn(esp.fornecedores) }))}
                />
              )}
              {view === "centros" && empresarial && (
                <PaginaCadastro
                  titulo="Centro de Custos"
                  singular="centro de custo"
                  itens={espaco.centrosCusto}
                  atualizarLista={(fn) => atualizarEspaco((esp) => ({ ...esp, centrosCusto: fn(esp.centrosCusto) }))}
                  extraInfo={(c) => {
                    const total = soma(
                      espaco.transacoes.filter((t) => t.centroCustoId === c.id && t.tipo === "despesa" && t.status === "ok")
                    );
                    return total > 0 ? `Total gasto: ${fmtBRL(total)}` : "Sem despesas vinculadas";
                  }}
                />
              )}
              {["clientes", "fornecedores", "centros"].includes(view) && !empresarial && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Esta página é do espaço Empresarial.
                  <button onClick={() => trocarModo("empresarial")} className="mx-auto mt-3 block h-11 rounded-xl bg-emerald-600 px-4 font-semibold text-white">
                    Ir para o Empresarial
                  </button>
                </div>
              )}
              {view === "conta" && (
                <PaginaConta
                  login={login}
                  sessao={sessao}
                  userId={userId}
                  onConectarTelegram={() => setMostrarTelegram(true)}
                  onLimparDados={limparEspaco}
                  onSair={sairComConfirmacao}
                  showToast={showToast}
                  onVerTour={() => setMostrarTour(true)}
                />
              )}
              {view === "mais" && (
                <PaginaMais
                  login={login}
                  email={sessao?.user?.email}
                  modo={modo}
                  trocarModo={trocarModo}
                  irPara={irPara}
                  escuro={escuro}
                  alternarTema={() => setEscuro((e) => !e)}
                  bioDisponivel={bioDisponivel}
                  bioAtivo={!!login?.bioCredId}
                  alternarBiometria={login?.bioCredId ? desativarBiometria : ativarBiometria}
                  onTelegram={() => setMostrarTelegram(true)}
                  onExportar={exportData}
                  onImportar={() => fileRef.current?.click()}
                  onTrocarFoto={() => fotoTrocaRef.current?.click()}
                  onSair={sairComConfirmacao}
                  onVerTour={() => setMostrarTour(true)}
                  userId={userId}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Barra de baixo — celular: 4 destinos + botão de lançar */}
      <nav
        className="barra-inferior fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
        aria-label="Menu principal"
      >
        <div className="grid h-16 grid-cols-5 items-stretch">
          {ABAS.map((a) =>
            a.id === "+" ? (
              <div key="+" className="flex items-center justify-center">
                <button
                  onClick={() => abrirLancamento({ tipo: "despesa" })}
                  className="flex h-14 w-14 -translate-y-3 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-95"
                  aria-label="Novo lançamento"
                >
                  <Plus size={28} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                key={a.id}
                onClick={() => irPara(a.id)}
                aria-current={aba === a.id ? "page" : undefined}
                className={
                  "flex flex-col items-center justify-center gap-1 text-xs font-semibold transition active:scale-95 " +
                  (aba === a.id ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400")
                }
              >
                <span className={"flex h-7 w-12 items-center justify-center rounded-full transition " + (aba === a.id ? "bg-emerald-100 dark:bg-emerald-950" : "")}>
                  <a.icon size={20} strokeWidth={aba === a.id ? 2.4 : 2} />
                </span>
                {a.label}
              </button>
            )
          )}
        </div>
      </nav>

      {/* Lançamento (novo / editar / duplicar) */}
      {lancamento && (
        <FormTransacao
          key={lancamento.chave}
          tipo={lancamento.tipo}
          inicial={lancamento.inicial || null}
          statusPadrao={lancamento.statusPadrao || "ok"}
          espaco={espaco}
          empresarial={empresarial}
          onSalvar={acoesTransacao.salvar}
          onCriarCategoria={acoesTransacao.criarCategoria}
          onFechar={() => setLancamento(null)}
          showToast={showToast}
        />
      )}

      {/* Trocar de espaço (Pessoal / Empresarial) */}
      {escolhendoModo && (
        <Sheet titulo="Trocar de espaço" onFechar={() => setEscolhendoModo(false)}>
          <div className="flex flex-col gap-2">
            {[
              ["pessoal", "Pessoal", User, "Casa e contas pessoais"],
              ["empresarial", "Empresarial", Briefcase, "Negócio, clientes e fornecedores"],
            ].map(([v, r, Icone, desc]) => (
              <button
                key={v}
                onClick={() => trocarModo(v)}
                aria-pressed={modo === v}
                className={
                  "flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-left transition " +
                  (modo === v
                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:bg-emerald-950"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")
                }
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300">
                  <Icone size={19} />
                </span>
                <span className="flex-1">
                  <span className="block text-base font-semibold text-slate-800 dark:text-slate-100">{r}</span>
                  <span className="block text-sm text-slate-500 dark:text-slate-400">{desc}</span>
                </span>
                {modo === v && <Check size={20} className="text-emerald-600" />}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* Input oculto para trocar a foto do perfil */}
      <input
        ref={fotoTrocaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setArquivoFoto(f);
          e.target.value = "";
        }}
      />

      {/* Ajuste de enquadramento da foto de perfil */}
      {arquivoFoto && <CropFotoModal file={arquivoFoto} onConfirmar={salvarFoto} onFechar={() => setArquivoFoto(null)} />}

      {mostrarTelegram && userId && (
        <ModalConectarTelegram userId={userId} nome={login?.nome} showToast={showToast} onFechar={() => setMostrarTelegram(false)} />
      )}

      {/* Tour de boas-vindas (1ª vez neste aparelho; revisível em Mais → Dicas) */}
      {mostrarTour && !mostrarTelegram && (
        <TourBoasVindas
          onFechar={fecharTour}
          bioDisponivel={bioDisponivel}
          bioAtivo={!!login?.bioCredId}
          onAtivarBiometria={ativarBiometria}
          onAbrirTelegram={() => {
            fecharTour();
            setMostrarTelegram(true);
          }}
        />
      )}

      {/* Input oculto para importar backup */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          importData(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Toast toast={toast} onFechar={fecharToast} />
    </div>
  );

}
