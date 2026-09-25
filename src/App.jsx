import React, { useState, useEffect, useRef } from "react";
import emblemaUrl from "./emblema.png";
import { User, Briefcase, ChevronLeft, ChevronRight, Download, Upload, Check, Loader2, Cloud, AlertTriangle, Moon, Sun, LogOut, Camera, ScanFace, Send } from "lucide-react";
import { definirNomeNuvem, sairNuvem, sessaoAtual, aoMudarAuth, marcarLoginNuvem, limparLoginNuvem, loginNuvemTs } from "./cloudAuth";
import { carregarTudo, sincronizar, migrarLocalParaNuvem } from "./cloudData";
import { temAutenticadorPlataforma, registrarBiometria, verificarBiometria } from "./biometria";
import { STORAGE_KEY, LOGIN_KEY, loginKey, TEMA_KEY, MIGR_KEY, URL_RECUPERACAO, NUVEM_MS, marcarDesbloqueio, limparDesbloqueio, desbloqueioRecente, TOUR_KEY, MESES, ANOS } from "./lib/constantes";
import { uid, fmtBRL, somaDias, soma } from "./lib/formato";
import { menorData, gerarProximasOcorrencias, estenderRecorrencias } from "./lib/recorrencia";
import { SEED, espacoVazio, dadosVazios, normalizarDados } from "./lib/dados";
import { storageGet, storageSet, hashPin } from "./lib/armazenamento";
import { serializarBackup, lerBackup, nomeArquivoBackup } from "./lib/backup";
import { gradientePorNome } from "./lib/cores";
import { CropFotoModal } from "./components/CropFotoModal";
import { PaginaTransacoes } from "./paginas/PaginaTransacoes";
import { PaginaDashboard } from "./paginas/PaginaDashboard";
import { PaginaContas } from "./paginas/PaginaContas";
import { PaginaFluxo } from "./paginas/PaginaFluxo";
import { PaginaMetas } from "./paginas/PaginaMetas";
import { PaginaCategorias } from "./paginas/PaginaCategorias";
import { PaginaCadastro } from "./paginas/PaginaCadastro";
import { PaginaRelatorios } from "./paginas/PaginaRelatorios";
import { TelaAuth, TelaNovaSenha } from "./telas/TelaAuth";
import { TelaLogin } from "./telas/TelaLogin";
import { NAV_PESSOAL, NAV_EMPRESA } from "./lib/navegacao";
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
          showToast("Salvo na nuvem ✓");
        } catch (e) {
          console.error("erro ao sincronizar com a nuvem:", e);
          setStatus("error");
          showToast("Não consegui salvar na nuvem. Vou tentar de novo.", true);
          // não atualiza ultimoSyncRef → tenta de novo na próxima mudança
        }
      } else if (okLocal) {
        setStatus("saved");
        showToast("Salvo ✓");
      } else {
        setStatus("error");
        showToast("Erro ao salvar. Tente novamente.", true);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loaded, nuvemPronta, userId]);

  function showToast(msg, isError = false, ms = 1800) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, isError });
    toastTimer.current = setTimeout(() => setToast(null), ms);
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

  const acoesTransacao = {
    // Salva o lançamento e cuida da recorrência:
    //  regra === undefined → não mexe na série (edição sem tocar na repetição)
    //  regra === null      → repetição desligada (encerra a série, se havia)
    //  regra = {tipo,cada,fim} → (re)programa a série a partir deste lançamento
    salvar: (t, regra) =>
      atualizarEspaco((esp) => {
        const anterior = t.id ? esp.transacoes.find((x) => x.id === t.id) : null;
        let base = t.id ? { ...t } : { ...t, id: uid() };
        let ts = anterior
          ? esp.transacoes.map((x) => (x.id === base.id ? base : x))
          : [...esp.transacoes, base];
        if (regra === undefined) return { ...esp, transacoes: ts };

        const grupoAntigo = anterior?.recorrencia?.grupo;
        if (grupoAntigo) {
          // a regra mudou (ou foi desligada): some com as próximas pendentes da
          // série antiga e encerra a regra nas que ficam (pra não renascerem)
          ts = ts
            .filter(
              (x) =>
                !(x.recorrencia?.grupo === grupoAntigo && x.id !== base.id && x.status === "pendente" && x.data > base.data)
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
          const r = { grupo: uid(), tipo: regra.tipo, cada: regra.cada ?? null, inicio: base.data, fim: regra.fim ?? null, n: 0 };
          base = { ...base, recorrencia: r };
          ts = ts.map((x) => (x.id === base.id ? base : x));
          const ids = new Set(ts.map((x) => x.id));
          ts = [...ts, ...gerarProximasOcorrencias(base, r, 1, ids)];
        } else if (base.recorrencia) {
          const { recorrencia: _r, ...semRec } = base;
          ts = ts.map((x) => (x.id === base.id ? semRec : x));
        }
        return { ...esp, transacoes: ts };
      }),
    // Exclui UMA conta. Se era a última programada de uma série sem término,
    // encerra a série ali — senão o app recriaria a parcela sozinho depois.
    excluir: (id) =>
      atualizarEspaco((esp) => {
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
      }),
    // Exclui a conta E todas as próximas da mesma série (as pagas ficam).
    excluirSerie: (id) =>
      atualizarEspaco((esp) => {
        const alvo = esp.transacoes.find((x) => x.id === id);
        const g = alvo?.recorrencia?.grupo;
        if (!g) return { ...esp, transacoes: esp.transacoes.filter((x) => x.id !== id) };
        return {
          ...esp,
          transacoes: esp.transacoes
            .filter(
              (x) => x.id !== id && !(x.recorrencia?.grupo === g && x.status === "pendente" && x.data >= alvo.data)
            )
            .map((x) =>
              x.recorrencia?.grupo === g
                ? { ...x, recorrencia: { ...x.recorrencia, fim: menorData(x.recorrencia.fim, somaDias(alvo.data, -1)) } }
                : x
            ),
        };
      }),
    marcarOk: (id) =>
      atualizarEspaco((esp) => ({
        ...esp,
        transacoes: esp.transacoes.map((x) => (x.id === id ? { ...x, status: "ok" } : x)),
      })),
    // Cria uma categoria no espaço ATUAL (modo pessoal/empresarial vigente) e
    // devolve o objeto {id,nome,cor}. Fica salva só neste login (via user_id na
    // nuvem) e só neste tipo (coluna modo). Se já existir pelo nome, reaproveita.
    criarCategoria: (nome, cor) => {
      const limpo = (nome || "").trim();
      if (!limpo) return null;
      const existente = data[modo].categorias.find(
        (c) => c.nome.toLowerCase() === limpo.toLowerCase(),
      );
      if (existente) return existente;
      const nova = { id: uid(), nome: limpo, cor: cor || gradientePorNome(limpo).id };
      atualizarEspaco((esp) => ({ ...esp, categorias: [...esp.categorias, nova] }));
      return nova;
    },
  };

  function trocarModo(novoModo) {
    if (novoModo === modo) return;
    setModo(novoModo);
    setView("dashboard");
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
    if (!window.confirm("Redefinir o PIN? Seus dados financeiros NÃO serão apagados — você só vai criar um novo PIN.")) return;
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
          const ok = window.confirm(
            "Encontramos os dados deste aparelho. Deseja enviá-los para a sua conta na nuvem?\n\nNada será apagado — eles ficam junto com o que você lançou pelo robô do Telegram.",
          );
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
        if (!window.confirm("Enviar este backup para a sua conta na nuvem?\n\nEle será somado ao que já existe — categorias com o mesmo nome não duplicam, e nada é apagado.")) return;
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
        if (!window.confirm("Importar este backup? Os dados atuais deste aparelho serão substituídos pelos do arquivo.")) return;
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

  function stepMonth(delta) {
    let mi = mesIdx + delta, y = ano;
    if (mi < 0) { mi = 11; y -= 1; }
    else if (mi > 11) { mi = 0; y += 1; }
    if (!ANOS.includes(y)) return;
    setMesIdx(mi);
    setAno(y);
  }

  const viewTitle = NAV.find((n) => n.id === view)?.label || "";
  const usaMes = ["dashboard", "receitas", "despesas", "relatorios"].includes(view);

  // Saudação com o nome da pessoa logada; a marca do app é fixa
  const nomeApp = "Thayfinance";
  const saudacao = login?.nome ? `Olá, ${login.nome.trim().split(/\s+/)[0]}` : nomeApp;

  useEffect(() => {
    document.title = `${nomeApp} — Controle financeiro`;
  }, []);

  if (auth === "init") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-950">
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

  const seletorModo = (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {[
        ["pessoal", "Pessoal", User],
        ["empresarial", "Empresarial", Briefcase],
      ].map(([v, r, Icon]) => (
        <button
          key={v}
          onClick={() => trocarModo(v)}
          className={
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition " +
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
          <img src={emblemaUrl} alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-base font-bold leading-tight text-slate-800 dark:text-slate-100">{saudacao}</p>
            <p className="text-xs text-slate-400">Controle financeiro</p>
          </div>
        </div>
        <div className="px-3 pb-2">{seletorModo}</div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition " +
                (view === n.id
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200")
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
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{login?.nome}</p>
              <button onClick={() => fotoTrocaRef.current?.click()} className="text-[11px] text-slate-400 underline-offset-2 hover:underline">
                Trocar foto
              </button>
            </div>
            <button
              onClick={sair}
              aria-label="Sair"
              title="Sair"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800 dark:hover:text-red-400"
            >
              <LogOut size={16} />
            </button>
          </div>
          {bioDisponivel && (
            <button
              onClick={login?.bioCredId ? desativarBiometria : ativarBiometria}
              className={
                "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition " +
                (login?.bioCredId
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800")
              }
            >
              <ScanFace size={16} /> {login?.bioCredId ? "Face ID / digital ativo" : "Ativar Face ID / digital"}
            </button>
          )}
          {userId && (
            <button
              onClick={() => setMostrarTelegram(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              <Send size={16} /> Conectar Telegram
            </button>
          )}
          <button
            onClick={exportData}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Download size={16} /> Exportar dados
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Upload size={16} /> Importar dados
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="md:pl-60">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex items-center gap-2 md:hidden">
              <button onClick={() => fotoTrocaRef.current?.click()} aria-label="Trocar foto" className="transition hover:opacity-80">
                {login?.foto ? (
                  <img src={login.foto} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <img src={emblemaUrl} alt="" className="h-7 w-7 object-contain" />
                )}
              </button>
              <span className="text-sm font-bold">{saudacao}</span>
            </div>

            <div className="md:hidden">{seletorModo}</div>

            {usaMes ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => stepMonth(-1)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300" aria-label="Mês anterior">
                  <ChevronLeft size={18} />
                </button>
                <select
                  value={mesIdx}
                  onChange={(e) => setMesIdx(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {MESES.map((mn, i) => (
                    <option key={mn} value={i}>
                      {mn}
                    </option>
                  ))}
                </select>
                <select
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {ANOS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button onClick={() => stepMonth(1)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300" aria-label="Próximo mês">
                  <ChevronRight size={18} />
                </button>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setEscuro((e) => !e)}
                aria-label="Alternar modo claro/escuro"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                {escuro ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <span
                className={
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium " +
                  (status === "saving"
                    ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                    : status === "error"
                    ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                    : status === "saved"
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500")
                }
              >
                {status === "saving" ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Salvando...
                  </>
                ) : status === "error" ? (
                  <>
                    <AlertTriangle size={13} /> Erro
                  </>
                ) : status === "saved" ? (
                  <>
                    <Check size={13} /> Salvo ✓
                  </>
                ) : (
                  <>
                    <Cloud size={13} /> Pronto
                  </>
                )}
              </span>
              {bioDisponivel && (
                <button
                  onClick={login?.bioCredId ? desativarBiometria : ativarBiometria}
                  className={
                    "rounded-lg p-1.5 transition md:hidden " +
                    (login?.bioCredId
                      ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300")
                  }
                  aria-label={login?.bioCredId ? "Desativar Face ID" : "Ativar Face ID / digital"}
                  title={login?.bioCredId ? "Face ID / digital ativo" : "Ativar Face ID / digital"}
                >
                  <ScanFace size={18} />
                </button>
              )}
              {userId && (
                <button onClick={() => setMostrarTelegram(true)} className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950 md:hidden" aria-label="Conectar Telegram" title="Conectar Telegram">
                  <Send size={18} />
                </button>
              )}
              <button onClick={exportData} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 md:hidden" aria-label="Exportar dados">
                <Download size={18} />
              </button>
              <button onClick={() => fileRef.current?.click()} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 md:hidden" aria-label="Importar dados">
                <Upload size={18} />
              </button>
              <button onClick={sair} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800 dark:hover:text-red-400 md:hidden" aria-label="Sair">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:pb-10">
          <h1 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">
            {viewTitle}
            <span className="ml-2 text-sm font-normal text-slate-400">
              {empresarial ? "Empresarial" : "Pessoal"}
              {usaMes ? ` · ${MESES[mesIdx]} de ${ano}` : ""}
            </span>
          </h1>

          {!loaded ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Carregando seus dados...
            </div>
          ) : (
            <>
              {view === "dashboard" && (
                <PaginaDashboard espaco={espaco} ano={ano} mesIdx={mesIdx} escuro={escuro} irPara={setView} />
              )}
              {view === "receitas" && (
                <PaginaTransacoes tipo="receita" espaco={espaco} empresarial={empresarial} ano={ano} mesIdx={mesIdx} acoes={acoesTransacao} showToast={showToast} />
              )}
              {view === "despesas" && (
                <PaginaTransacoes tipo="despesa" espaco={espaco} empresarial={empresarial} ano={ano} mesIdx={mesIdx} acoes={acoesTransacao} showToast={showToast} />
              )}
              {view === "contas" && <PaginaContas espaco={espaco} empresarial={empresarial} acoes={acoesTransacao} />}
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
                      espaco.transacoes.filter(
                        (t) => t.centroCustoId === c.id && t.tipo === "despesa" && t.status === "ok"
                      )
                    );
                    return total > 0 ? `Total gasto: ${fmtBRL(total)}` : "Sem despesas vinculadas";
                  }}
                />
              )}
              {view === "conta" && (
                <PaginaConta
                  login={login}
                  sessao={sessao}
                  userId={userId}
                  onConectarTelegram={() => setMostrarTelegram(true)}
                  onLimparDados={limparEspaco}
                  onSair={sair}
                  showToast={showToast}
                  onVerTour={() => setMostrarTour(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Navegação inferior — mobile (rolável) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <div className="flex overflow-x-auto">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={
                "flex min-w-[72px] flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition " +
                (view === n.id ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500")
              }
            >
              <n.icon size={19} />
              <span className="truncate px-1">{n.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </nav>

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
      {arquivoFoto && (
        <CropFotoModal
          file={arquivoFoto}
          onConfirmar={salvarFoto}
          onFechar={() => setArquivoFoto(null)}
        />
      )}

      {mostrarTelegram && userId && (
        <ModalConectarTelegram
          userId={userId}
          nome={login?.nome}
          showToast={showToast}
          onFechar={() => setMostrarTelegram(false)}
        />
      )}

      {/* Tour de boas-vindas (1ª vez neste aparelho; revisível na aba Conta) */}
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

      {/* Toast */}
      {toast && (
        <div
          className={
            "fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg md:bottom-6 " +
            (toast.isError ? "bg-red-500" : "bg-emerald-600")
          }
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
