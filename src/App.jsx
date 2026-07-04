import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  ArrowLeftRight,
  Target,
  Tags,
  FileText,
  Users,
  Truck,
  FolderOpen,
  User,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Check,
  Loader2,
  Cloud,
  AlertTriangle,
  Wallet,
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  X,
  Moon,
  Sun,
  LogOut,
  Camera,
  Mic,
  Square,
  Image as ImageIcon,
  Sparkles,
  ScanFace,
  Printer,
  FileSpreadsheet,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Send,
  Copy,
  RefreshCw,
  Palette,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import logoUrl from "./logo.png";
import emblemaUrl from "./emblema.png";
import bgLoginUrl from "./bg-login.jpg";
import { supabase } from "./supabaseClient";
import {
  cadastrar as cadastrarNuvem,
  entrar as entrarNuvem,
  reenviarConfirmacao,
  redefinirSenha,
  atualizarSenha,
  definirNomeNuvem,
  sairNuvem,
  sessaoAtual,
  aoMudarAuth,
  marcarLoginNuvem,
  limparLoginNuvem,
  loginNuvemTs,
} from "./cloudAuth";
import { carregarTudo, sincronizar, migrarLocalParaNuvem } from "./cloudData";
import { gerarCodigoTelegram, statusTelegram, desconectarTelegram, BOT_URL, BOT_USERNAME } from "./telegramLink";
import {
  temAutenticadorPlataforma,
  registrarBiometria,
  verificarBiometria,
} from "./biometria";

// Dados reais importados das planilhas — o arquivo fica só neste computador,
// fora do repositório público. Na versão publicada ele não existe e o app
// abre vazio (os dados entram pelo botão "Importar dados").
const seedFiles = import.meta.glob("./dadosPlanilha.json", { eager: true });
const SEED = seedFiles["./dadosPlanilha.json"]?.default ?? { months: {} };

/* ============================================================
   CONSTANTES
   ============================================================ */

const STORAGE_KEY = "financas_app_data";
const LOGIN_KEY = "financas_app_login";
// A trava local (PIN/foto/nome) é POR CONTA: cada usuário da nuvem tem a sua,
// senão uma conta herda o PIN/foto de outra que já usou este aparelho.
// Sem sessão (offline), cai na chave antiga (compatibilidade).
const loginKey = (uid) => (uid ? `${LOGIN_KEY}:${uid}` : LOGIN_KEY);
const TEMA_KEY = "financas_app_tema";
const MIGR_KEY = "financas_app_migrado_"; // + userId: marca que já perguntamos da migração

// Captura, JÁ na abertura, se o app foi aberto por um link de "Esqueci a senha".
// Roda no import (antes do supabase-js processar e limpar o hash da URL), então
// é confiável para desviar o fluxo para a tela de nova senha em vez de "open".
const URL_RECUPERACAO =
  typeof window !== "undefined" && /[#&?]type=recovery/.test(window.location.hash || "");

// Janela de desbloqueio: por 1h após desbloquear, recarregar/reabrir não pede
// PIN/biometria (pede de novo só depois de 1h).
const DESBLOQUEIO_KEY = "financas_app_desbloqueio";
const GRACA_MS = 60 * 60 * 1000; // 1 hora
// Login na nuvem (e-mail/senha) só é repedido a cada 24h.
const NUVEM_MS = 24 * 60 * 60 * 1000; // 24 horas
function marcarDesbloqueio() {
  try {
    localStorage.setItem(DESBLOQUEIO_KEY, String(Date.now()));
  } catch {
    /* sem armazenamento */
  }
}
function limparDesbloqueio() {
  try {
    localStorage.removeItem(DESBLOQUEIO_KEY);
  } catch {
    /* sem armazenamento */
  }
}
function desbloqueioRecente() {
  try {
    const t = Number(localStorage.getItem(DESBLOQUEIO_KEY) || 0);
    return t > 0 && Date.now() - t < GRACA_MS;
  } catch {
    return false;
  }
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MESES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
const ANOS = [2024, 2025, 2026, 2027];

const CATS_PESSOAL = [
  "Alimentação", "Transporte", "Moradia", "Saúde", "Lazer",
  "Salário", "Investimentos", "Outros",
];
const CATS_EMPRESA = [
  "Faturamento", "Fornecedores", "Impostos", "Funcionários",
  "Infraestrutura", "Marketing", "Investimentos", "Outros",
];

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

const nfBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nfNum = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (v) => nfBRL.format(Number.isFinite(v) ? v : 0);
const fmtNum = (v) => nfNum.format(Number.isFinite(v) ? v : 0);

function parseBR(text) {
  const t = String(text).trim();
  if (t === "") return 0;
  let s = t.replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const mesPrefixo = (ano, mesIdx) => `${ano}-${String(mesIdx + 1).padStart(2, "0")}`;
const somaDias = (iso, dias) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const soma = (ts) => ts.reduce((a, t) => a + (Number(t.valor) || 0), 0);

/* ============================================================
   ESTRUTURA DOS DADOS (v2 — lançamentos)
   ============================================================ */

function espacoVazio(modo) {
  const nomes = modo === "empresarial" ? CATS_EMPRESA : CATS_PESSOAL;
  return {
    transacoes: [], // {id, tipo, data, categoriaId, valor, descricao, status, clienteId?, fornecedorId?, centroCustoId?}
    categorias: nomes.map((nome) => ({ id: uid(), nome })),
    metas: [], // {id, nome, alvo, atual}
    clientes: [],
    fornecedores: [],
    centrosCusto: [],
  };
}

const dadosVazios = () => ({
  versao: 2,
  pessoal: espacoVazio("pessoal"),
  empresarial: espacoVazio("empresarial"),
});

/* ============================================================
   MIGRAÇÃO v1 → v2 (planilhas / app antigo → lançamentos)
   ============================================================ */

const V1_PESSOAIS = [
  "CPFL", "Naturgy", "Netflix", "Disney", "Internet", "Faxina", "Tim",
  "Combustível", "Cartão MEI", "Cartão Mãe", "Cartão Xuxu", "Cartão Havan",
  "Outros cartões", "Restaurantes", "Roupas Thaysa", "Ana Boucles", "Viagem",
  "Chácara Natal", "Mercado", "Pós-graduação", "Custos variáveis",
  "Noite das meninas", "Anderson-edi", "Thais ateliê", "Roupas Thales",
  "Manicure", "Farmácia", "Psicóloga mãe", "Uber", "Cílios/Sobrancelha",
  "Transferências marido", "Massagem/Lipo", "Dentista",
  "Idas para São Paulo", "Outros",
];
const V1_PESSOAIS_CAT = {
  0: "Moradia", 1: "Moradia", 2: "Lazer", 3: "Lazer", 4: "Moradia",
  5: "Moradia", 6: "Moradia", 7: "Transporte", 13: "Alimentação",
  16: "Lazer", 17: "Lazer", 18: "Alimentação", 21: "Lazer", 25: "Lazer",
  26: "Saúde", 27: "Saúde", 28: "Transporte", 29: "Lazer", 31: "Saúde",
  32: "Saúde", 33: "Transporte",
};
const V1_FIXOS = {
  aluguel: ["Aluguel", "Infraestrutura"], iptu: ["IPTU", "Impostos"],
  marketing: ["Marketing", "Marketing"], internet: ["Internet", "Infraestrutura"],
  materialAuriculo: ["Material auriculoterapia", "Fornecedores"],
  materialMassagem: ["Material massagem", "Fornecedores"],
  sistema: ["Sistema/Aplicativo", "Infraestrutura"], crefito: ["CREFITO", "Impostos"],
  energia: ["Energia elétrica", "Infraestrutura"], agua: ["Água", "Infraestrutura"],
  datasMkt: ["Datas comemorativas MKT", "Marketing"],
  estacionamento: ["Estacionamento", "Infraestrutura"],
  contador: ["Contador", "Funcionários"], inss: ["INSS", "Impostos"],
  prolabore: ["Pró-labore", "Funcionários"], faxineira: ["Faxineira", "Funcionários"],
  ferias13: ["Férias e 13º", "Funcionários"],
  investimentos: ["Investimentos", "Investimentos"],
  reserva: ["Reserva de emergência", "Investimentos"],
  refeicao: ["Refeição funcionários", "Funcionários"],
  mercado: ["Despesas de mercado", "Fornecedores"],
};
const V1_VARIAVEIS = {
  impostoVenda: ["Imposto sobre venda", "Impostos"],
  taxaCartao: ["Taxa de cartão", "Outros"],
  cafeBiscoitos: ["Café/biscoitos", "Fornecedores"],
  lembrancinhas: ["Lembrancinhas", "Fornecedores"],
  materialLimpeza: ["Material de limpeza", "Fornecedores"],
  outrosVariaveis: ["Outros variáveis", "Outros"],
};
const V1_ANUAIS = {
  contadora13: ["13º Contadora", "Funcionários"],
  faxineira13: ["13º Faxineira", "Funcionários"],
  certificadoDigital: ["Certificado digital", "Outros"],
};

function migrarV1(antigo) {
  const novo = dadosVazios();
  const catId = (esp, nome) => {
    let c = esp.categorias.find((x) => x.nome === nome);
    if (!c) {
      c = { id: uid(), nome };
      esp.categorias.push(c);
    }
    return c.id;
  };
  const meses = (antigo && antigo.months) || {};
  Object.keys(meses)
    .sort()
    .forEach((chave) => {
      const m = meses[chave] || {};
      const dia15 = `${chave}-15`;
      const addDespesa = (esp, valor, descricao, catNome) => {
        if (!valor || valor <= 0) return;
        esp.transacoes.push({
          id: uid(), tipo: "despesa", data: dia15,
          categoriaId: catId(esp, catNome),
          valor: Math.round(valor * 100) / 100,
          descricao, status: "ok",
        });
      };
      // Gastos pessoais
      Object.entries(m.pessoais || {}).forEach(([k, v]) => {
        const i = parseInt(k.slice(1), 10);
        addDespesa(novo.pessoal, Number(v), V1_PESSOAIS[i] || "Outros",
          V1_PESSOAIS_CAT[i] || "Outros");
      });
      // Custos do negócio
      Object.entries(m.fixos || {}).forEach(([k, v]) => {
        const def = V1_FIXOS[k];
        if (def) addDespesa(novo.empresarial, Number(v), def[0], def[1]);
      });
      Object.entries(m.variaveis || {}).forEach(([k, v]) => {
        const def = V1_VARIAVEIS[k];
        if (def) addDespesa(novo.empresarial, Number(v), def[0], def[1]);
      });
      Object.entries(m.anuais || {}).forEach(([k, v]) => {
        const def = V1_ANUAIS[k];
        if (def && v > 0)
          addDespesa(novo.empresarial, Number(v) / 12, def[0] + " (anual ÷12)", def[1]);
      });
      // Faturamento
      const fat = m.dre && Number(m.dre.faturamento);
      if (fat > 0) {
        novo.empresarial.transacoes.push({
          id: uid(), tipo: "receita", data: dia15,
          categoriaId: catId(novo.empresarial, "Faturamento"),
          valor: fat, descricao: "Faturamento do mês", status: "ok",
        });
      }
    });
  return novo;
}

function normalizarDados(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.versao === 2 && parsed.pessoal && parsed.empresarial) {
    const base = dadosVazios();
    return {
      versao: 2,
      pessoal: { ...base.pessoal, ...parsed.pessoal },
      empresarial: { ...base.empresarial, ...parsed.empresarial },
    };
  }
  if (parsed.months) return migrarV1(parsed); // formato antigo (planilhas)
  return null;
}

/* ============================================================
   ARMAZENAMENTO (Artifact Storage com fallback p/ localStorage)
   ============================================================ */

async function storageGet(key) {
  try {
    const s = typeof window !== "undefined" ? window.storage : null;
    if (s) {
      if (typeof s.getItem === "function") {
        const r = await s.getItem(key);
        if (r == null) return null;
        return typeof r === "string" ? r : r.value ?? null;
      }
      if (typeof s.get === "function") {
        const r = await s.get(key);
        if (r == null) return null;
        return typeof r === "string" ? r : r.value ?? null;
      }
    }
  } catch {
    /* cai para localStorage */
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function storageSet(key, value) {
  try {
    const s = typeof window !== "undefined" ? window.storage : null;
    if (s) {
      if (typeof s.setItem === "function") {
        await s.setItem(key, value);
        return true;
      }
      if (typeof s.set === "function") {
        await s.set(key, value);
        return true;
      }
    }
  } catch {
    /* cai para localStorage */
  }
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

// Hash do PIN (nunca guardamos o PIN em si)
async function hashPin(pin, salt) {
  const texto = salt + ":" + pin;
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0;
    for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
    return "f" + (h >>> 0).toString(16);
  }
}


/* ============================================================
   EXPORTAÇÕES (PDF via impressão / Excel via CSV)
   ============================================================ */

// Escapa texto para inserir com segurança dentro de HTML. Usado na exportação
// de PDF (document.write numa janela do MESMO domínio): sem isso, um nome de
// categoria/descrição com "<img onerror=...>" viraria JS rodando no app.
function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function exportarPDF(titulo, corpoHtml) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escHtml(titulo)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 18px 0 6px; }
  p.sub { color: #64748b; margin: 0 0 16px; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  td.num, th.num { text-align: right; }
  th { background: #f1f5f9; }
  tr.total td { font-weight: bold; background: #ecfdf5; }
</style></head><body>${corpoHtml}
<script>window.onload = function () { window.print(); };<\/script></body></html>`);
  w.document.close();
  return true;
}

// Evita "CSV formula injection": uma célula começando com = + @ (ou tab/CR)
// pode virar fórmula ao abrir no Excel. Prefixa com ' pra forçar texto.
// Números negativos ("-1.234,56") são preservados (- seguido de dígito).
function protegerCsv(v) {
  let s = String(v ?? "");
  if (/^[=+@\t\r]/.test(s) || /^-(?!\d)/.test(s)) s = "'" + s;
  return s;
}

function exportarExcel(nomeArquivo, linhas) {
  const csv =
    "﻿" +
    linhas
      .map((l) => l.map((c) => `"${protegerCsv(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   CORES DAS CATEGORIAS (gradientes)
   Cada categoria tem um gradiente: o escolhido pela pessoa (campo `cor`,
   guardado junto da categoria) ou um SUGERIDO pelo nome — assim até as
   categorias criadas pelo robô do Telegram ganham cor na hora.
   ============================================================ */

const GRADIENTES = [
  { id: "esmeralda", nome: "Esmeralda", de: "#059669", para: "#34d399" },
  { id: "turquesa", nome: "Turquesa", de: "#0d9488", para: "#2dd4bf" },
  { id: "oceano", nome: "Oceano", de: "#0284c7", para: "#38bdf8" },
  { id: "ceu", nome: "Céu", de: "#2563eb", para: "#60a5fa" },
  { id: "indigo", nome: "Índigo", de: "#4f46e5", para: "#818cf8" },
  { id: "roxo", nome: "Roxo", de: "#7c3aed", para: "#a78bfa" },
  { id: "fucsia", nome: "Fúcsia", de: "#c026d3", para: "#e879f9" },
  { id: "rosa", nome: "Rosa", de: "#db2777", para: "#f472b6" },
  { id: "vermelho", nome: "Vermelho", de: "#dc2626", para: "#f87171" },
  { id: "tangerina", nome: "Tangerina", de: "#ea580c", para: "#fb923c" },
  { id: "ambar", nome: "Âmbar", de: "#d97706", para: "#fbbf24" },
  { id: "lima", nome: "Lima", de: "#65a30d", para: "#a3e635" },
  { id: "grafite", nome: "Grafite", de: "#475569", para: "#94a3b8" },
];
const gradPorId = (id) => GRADIENTES.find((g) => g.id === id) || null;

// Sugere um gradiente pelo NOME da categoria (palavras-chave, sem acentos).
// Sem palavra conhecida → hash determinístico (mesmo nome = mesma cor sempre).
function gradientePorNome(nome) {
  const n = (nome || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const tem = (...ks) => ks.some((k) => n.includes(k));
  if (tem("salario", "renda", "faturamento", "venda", "receb", "pagamento", "pix")) return gradPorId("esmeralda");
  if (tem("invest", "poupanca", "reserva", "aplicacao", "cripto", "acoes")) return gradPorId("turquesa");
  if (tem("mercado", "supermerc", "feira", "aliment", "comida", "restaur", "lanche", "padaria", "ifood", "pizza", "acougue", "hortifr")) return gradPorId("tangerina");
  if (tem("saude", "farm", "medic", "hospital", "consulta", "exame", "dentista", "remedio")) return gradPorId("rosa");
  if (tem("transp", "uber", "combust", "gasolina", "carro", "onibus", "taxi", "99", "metro", "passagem", "pedagio", "estaciona", "moto")) return gradPorId("indigo");
  if (tem("casa", "moradia", "alug", "condom", "imovel", "reforma", "movel", "moveis")) return gradPorId("ambar");
  if (tem("agua", "luz", "energia", "internet", "telefone", "celular", "wifi", "gas", "conta")) return gradPorId("ceu");
  if (tem("lazer", "cinema", "viagem", "festa", "show", "passeio", "streaming", "netflix", "spotify", "jogo")) return gradPorId("roxo");
  if (tem("educ", "escola", "curso", "faculdade", "livro", "mensalidade")) return gradPorId("oceano");
  if (tem("roupa", "vestu", "moda", "sapato", "calcad", "beleza", "salao", "cabelo", "estetica", "unha", "manicure")) return gradPorId("fucsia");
  if (tem("pet", "animal", "veterin", "racao")) return gradPorId("lima");
  if (tem("imposto", "taxa", "juro", "multa", "tarifa", "divida", "emprestimo", "cartao")) return gradPorId("vermelho");
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (Math.imul(31, h) + n.charCodeAt(i)) | 0;
  return GRADIENTES[Math.abs(h) % GRADIENTES.length];
}

// Gradiente FINAL de uma categoria: o escolhido (cor) ou o sugerido pelo nome.
const gradCat = (cat) => gradPorId(cat?.cor) || gradientePorNome(cat?.nome);
// CSS pronto: linear-gradient do gradiente g
const cssGrad = (g) => `linear-gradient(135deg, ${g.de}, ${g.para})`;

// Bolinhas de escolha de cor. `valor` = id escolhido (null = automática);
// `sugestao` = gradiente sugerido pelo nome (mostrado como ativo se nada foi
// escolhido). Passa onChange(null) ao re-clicar a ativa (volta pra automática).
function SeletorGradiente({ valor, sugestao, onChange }) {
  const ativoId = valor || sugestao?.id;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {GRADIENTES.map((g) => {
        const ativo = ativoId === g.id;
        return (
          <button
            type="button"
            key={g.id}
            title={g.nome}
            aria-label={"Cor " + g.nome}
            onClick={() => onChange(valor === g.id ? null : g.id)}
            className={
              "h-7 w-7 rounded-full transition-transform " +
              (ativo
                ? "scale-110 ring-2 ring-slate-700 ring-offset-2 dark:ring-slate-200 dark:ring-offset-slate-900"
                : "hover:scale-110")
            }
            style={{ background: cssGrad(g) }}
          />
        );
      })}
    </div>
  );
}

/* ============================================================
   COMPONENTES BÁSICOS
   ============================================================ */

function Card({ children, className = "" }) {
  return (
    <div
      className={
        "rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5 " +
        className
      }
    >
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone = "default" }) {
  const tones = {
    default: "text-slate-800 dark:text-slate-100",
    good: "text-emerald-600",
    bad: "text-red-600",
    warn: "text-amber-600",
  };
  return (
    <Card className="flex items-start gap-2.5 !p-3 sm:gap-3 sm:!p-5">
      <div className="hidden rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 sm:block">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">
          {label}
        </p>
        <p className={"mt-0.5 break-words text-base font-semibold leading-tight sm:text-xl " + tones[tone]}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {children}
      </h2>
      {right}
    </div>
  );
}

function BotaoPrimario({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 " +
        className
      }
    >
      {children}
    </button>
  );
}

function BotaoLeve({ children, onClick, className = "", title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 " +
        className
      }
    >
      {children}
    </button>
  );
}

function CurrencyField({ value, onChange, className = "", placeholder = "0,00" }) {
  const [text, setText] = useState(null);
  const display = text !== null ? text : value ? fmtNum(value) : "";
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      onFocus={() => setText(value ? String(value).replace(".", ",") : "")}
      onChange={(e) => {
        const t = e.target.value;
        if (/^[\d.,\sR$]*$/.test(t)) setText(t);
      }}
      onBlur={(e) => {
        setText(null);
        const n = parseBR(e.target.value);
        if (n === null) return;
        onChange(Math.max(0, n));
      }}
      className={
        "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40 " +
        className
      }
    />
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40";

function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function Modal({ titulo, onFechar, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-slate-900 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{titulo}</h3>
          <button
            onClick={onFechar}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Tela de ajuste de foto: arrastar + zoom dentro de um círculo antes de salvar
function CropFotoModal({ file, onConfirmar, onFechar }) {
  const F = 256; // tamanho do quadro de recorte (px)
  const [url, setUrl] = useState(null); // imagem como data URL (sobrevive ao StrictMode)
  const [nat, setNat] = useState(null); // dimensões naturais da imagem
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [erro, setErro] = useState(false);
  const drag = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setUrl(reader.result);
    reader.onerror = () => setErro(true);
    reader.readAsDataURL(file);
  }, [file]);

  const base = nat ? F / Math.min(nat.w, nat.h) : 1; // "cobrir" o quadro no zoom 1
  const dispW = nat ? nat.w * base * zoom : F;
  const dispH = nat ? nat.h * base * zoom : F;

  const limitar = (o) => ({
    x: Math.min(0, Math.max(F - dispW, o.x)),
    y: Math.min(0, Math.max(F - dispH, o.y)),
  });

  function aoCarregar(e) {
    const w = e.target.naturalWidth, h = e.target.naturalHeight;
    setNat({ w, h });
    const b = F / Math.min(w, h);
    setOff({ x: (F - w * b) / 2, y: (F - h * b) / 2 }); // centraliza
  }

  useEffect(() => {
    setOff((o) => limitar(o));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, nat]);

  function descer(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  }
  function mover(e) {
    if (!drag.current) return;
    setOff(
      limitar({
        x: drag.current.ox + (e.clientX - drag.current.x),
        y: drag.current.oy + (e.clientY - drag.current.y),
      })
    );
  }
  function soltar() {
    drag.current = null;
  }

  function confirmar() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = F;
      const ctx = canvas.getContext("2d");
      const s = base * zoom;
      ctx.drawImage(imgRef.current, -off.x / s, -off.y / s, F / s, F / s, 0, 0, F, F);
      onConfirmar(canvas.toDataURL("image/jpeg", 0.85));
    } catch {
      setErro(true);
    }
  }

  return (
    <Modal titulo="Ajustar foto" onFechar={onFechar}>
      <div className="space-y-4">
        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-full border-2 border-emerald-500 bg-slate-100 dark:bg-slate-800"
          style={{ width: F, height: F, maxWidth: "100%" }}
          onPointerDown={descer}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          {url ? (
            <img
              ref={imgRef}
              src={url}
              alt=""
              onLoad={aoCarregar}
              onError={() => setErro(true)}
              draggable={false}
              style={{
                position: "absolute",
                left: off.x,
                top: off.y,
                width: dispW,
                height: dispH,
                maxWidth: "none",
                cursor: "grab",
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-emerald-600"
          />
        </div>
        <p className="text-center text-xs text-slate-400">
          Arraste a foto para enquadrar e use o zoom. O círculo mostra o que vai aparecer.
        </p>
        {erro && (
          <p className="text-center text-sm text-red-600 dark:text-red-400">
            Não foi possível abrir essa imagem. Tente outra.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <BotaoPrimario onClick={confirmar} className="flex-1 justify-center">
            <Check size={16} /> Usar foto
          </BotaoPrimario>
        </div>
      </div>
    </Modal>
  );
}

function ChipStatus({ status, tipo }) {
  const ok = status === "ok";
  const rotulo = ok ? (tipo === "receita" ? "Recebido" : "Pago") : "Pendente";
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
        (ok
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400")
      }
    >
      {rotulo}
    </span>
  );
}

/* ============================================================
   FORMULÁRIOS
   ============================================================ */

function FormTransacao({ tipo, inicial, espaco, empresarial, onSalvar, onCriarCategoria, onFechar }) {
  const ENTRADAS = ["Faturamento", "Salário"];
  const catPadrao =
    tipo === "receita"
      ? espaco.categorias.find((c) => ENTRADAS.includes(c.nome)) || espaco.categorias[0]
      : espaco.categorias.find((c) => !ENTRADAS.includes(c.nome)) || espaco.categorias[0];
  const [t, setT] = useState(
    inicial || {
      tipo,
      data: hojeISO(),
      categoriaId: catPadrao?.id || "",
      valor: 0,
      descricao: "",
      status: "ok",
      clienteId: "",
      fornecedorId: "",
      centroCustoId: "",
    }
  );
  const [erro, setErro] = useState("");
  const ehReceita = (inicial ? inicial.tipo : tipo) === "receita";
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }));

  // Criação de categoria na hora, sem sair do lançamento.
  const [criandoCat, setCriandoCat] = useState(false);
  const [novaCat, setNovaCat] = useState("");
  const [novaCor, setNovaCor] = useState(null); // null = automática (sugerida pelo nome)
  const sugestaoCat = gradientePorNome(novaCat); // acompanha o que a pessoa digita
  function confirmarNovaCat() {
    const nome = novaCat.trim();
    if (!nome) {
      setCriandoCat(false);
      return;
    }
    // guarda a cor resolvida (escolhida ou sugerida) pra ficar estável
    const cat = onCriarCategoria?.(nome, novaCor || sugestaoCat.id); // salva no login+tipo atuais
    if (cat?.id) set("categoriaId", cat.id); // já seleciona a nova
    setNovaCat("");
    setNovaCor(null);
    setCriandoCat(false);
  }

  function salvar(e) {
    e.preventDefault();
    if (!t.data) return setErro("Escolha a data.");
    if (!t.valor || t.valor <= 0) return setErro("Digite um valor maior que zero.");
    if (!t.categoriaId) return setErro("Escolha uma categoria.");
    onSalvar(t);
    onFechar();
  }

  return (
    <Modal
      titulo={(inicial?.id ? "Editar " : "Nova ") + (ehReceita ? "receita" : "despesa")}
      onFechar={onFechar}
    >
      <form onSubmit={salvar} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data">
            <input
              type="date"
              value={t.data}
              onChange={(e) => set("data", e.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo label="Valor (R$)">
            <CurrencyField value={t.valor} onChange={(v) => set("valor", v)} className="!w-full" />
          </Campo>
        </div>
        <Campo label="Categoria">
          {criandoCat ? (
            <div className="space-y-2.5 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex gap-2">
                {/* pré-visualização ao vivo: a bolinha muda junto com o nome/cor */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                  style={{ background: cssGrad(gradPorId(novaCor) || sugestaoCat) }}
                >
                  {(novaCat.trim()[0] || "?").toUpperCase()}
                </div>
                <input
                  type="text"
                  value={novaCat}
                  onChange={(e) => setNovaCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmarNovaCat();
                    } else if (e.key === "Escape") {
                      setNovaCat("");
                      setNovaCor(null);
                      setCriandoCat(false);
                    }
                  }}
                  placeholder="Nome da nova categoria"
                  className={inputCls + " flex-1"}
                  autoFocus
                />
              </div>
              <SeletorGradiente valor={novaCor} sugestao={sugestaoCat} onChange={setNovaCor} />
              <p className="text-[11px] text-slate-400">
                {novaCor
                  ? `Cor escolhida: ${gradPorId(novaCor)?.nome}`
                  : `Cor automática pela categoria: ${sugestaoCat.nome} — toque numa bolinha pra trocar`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmarNovaCat}
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Salvar categoria
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNovaCat("");
                    setNovaCor(null);
                    setCriandoCat(false);
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={t.categoriaId}
                onChange={(e) => set("categoriaId", e.target.value)}
                className={inputCls + " flex-1"}
              >
                {espaco.categorias.length === 0 && <option value="">— nenhuma ainda —</option>}
                {espaco.categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              {onCriarCategoria && (
                <button
                  type="button"
                  onClick={() => setCriandoCat(true)}
                  className="flex items-center gap-1 rounded-xl border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                  aria-label="Criar nova categoria"
                >
                  <Plus size={16} /> Nova
                </button>
              )}
            </div>
          )}
        </Campo>
        <Campo label="Descrição">
          <input
            type="text"
            value={t.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder={ehReceita ? "Ex.: venda, sessão, salário..." : "Ex.: aluguel, mercado..."}
            className={inputCls}
          />
        </Campo>
        <Campo label="Status">
          <select value={t.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
            <option value="ok">{ehReceita ? "Recebido" : "Pago"}</option>
            <option value="pendente">Pendente</option>
          </select>
        </Campo>
        {empresarial && ehReceita && espaco.clientes.length > 0 && (
          <Campo label="Cliente (opcional)">
            <select
              value={t.clienteId || ""}
              onChange={(e) => set("clienteId", e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {espaco.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
        )}
        {empresarial && !ehReceita && (
          <div className="grid grid-cols-2 gap-3">
            {espaco.fornecedores.length > 0 && (
              <Campo label="Fornecedor (opcional)">
                <select
                  value={t.fornecedorId || ""}
                  onChange={(e) => set("fornecedorId", e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {espaco.fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            {espaco.centrosCusto.length > 0 && (
              <Campo label="Centro de custo (opcional)">
                <select
                  value={t.centroCustoId || ""}
                  onChange={(e) => set("centroCustoId", e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {espaco.centrosCusto.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
        )}
        {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        <BotaoPrimario className="w-full justify-center">
          <Check size={16} /> Salvar
        </BotaoPrimario>
      </form>
    </Modal>
  );
}

/* ============================================================
   CAPTURA POR IA (áudio + foto de comprovante)
   ============================================================ */

// Comprime e redimensiona a imagem antes de enviar/guardar (economia de espaço)
function comprimirImagem(file, maxLado = 1280, q = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const escala = Math.min(1, maxLado / Math.max(width, height));
        width = Math.round(width * escala);
        height = Math.round(height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", q);
        resolve({ dataUrl, base64: dataUrl.split(",")[1] });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Dois botões: 🎙️ Áudio e 📷 Comprovante. Chamam a IA e devolvem o
// lançamento pronto (via onResultado) pra pessoa conferir e salvar.
function CapturaIA({ onResultado, showToast }) {
  const [estado, setEstado] = useState("idle"); // idle | gravando | processando
  const fotoRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  async function chamarIA(payload, extra = {}) {
    setEstado("processando");
    try {
      const { data, error } = await supabase.functions.invoke("processar", { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.erro || "falhou");
      onResultado({ ...data, ...extra });
    } catch {
      showToast("A IA não conseguiu ler. Pode tentar de novo?", true);
    } finally {
      setEstado("idle");
    }
  }

  async function aoEscolherFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setEstado("processando");
      const { dataUrl, base64 } = await comprimirImagem(file);
      await chamarIA({ kind: "foto", base64, mime: "image/jpeg" }, { comprovante: dataUrl });
    } catch {
      setEstado("idle");
      showToast("Não consegui abrir essa imagem.", true);
    }
  }

  async function gravarAudio() {
    if (estado === "processando") return;
    if (estado === "gravando") {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => ev.data.size > 0 && chunksRef.current.push(ev.data);
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const base64 = await blobParaBase64(blob);
        await chamarIA({ kind: "audio", base64, mime: rec.mimeType || "audio/webm" });
      };
      recRef.current = rec;
      rec.start();
      setEstado("gravando");
    } catch {
      showToast("Não consegui acessar o microfone. Permita o acesso e tente de novo.", true);
    }
  }

  const ocupado = estado === "processando";

  return (
    <>
      <input
        ref={fotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={aoEscolherFoto}
      />
      {ocupado ? (
        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:border-emerald-800 dark:text-emerald-400">
          <Loader2 size={14} className="animate-spin" /> lendo com IA…
        </span>
      ) : (
        <>
          <BotaoLeve
            onClick={gravarAudio}
            title="Lançar por áudio"
            className={estado === "gravando" ? "!border-red-300 !bg-red-50 !text-red-600 dark:!bg-red-950" : ""}
          >
            {estado === "gravando" ? <><Square size={14} /> Parar</> : <><Mic size={14} /> Áudio</>}
          </BotaoLeve>
          <BotaoLeve onClick={() => fotoRef.current?.click()} title="Ler comprovante">
            <Camera size={14} /> Comprovante
          </BotaoLeve>
        </>
      )}
    </>
  );
}

/* ============================================================
   LISTA DE LANÇAMENTOS (Receitas / Despesas)
   ============================================================ */

function PaginaTransacoes({ tipo, espaco, empresarial, ano, mesIdx, acoes, showToast }) {
  const [form, setForm] = useState(null); // null | {} novo | transacao p/ editar
  const [verComprovante, setVerComprovante] = useState(null); // dataURL p/ visualizar
  const prefixo = mesPrefixo(ano, mesIdx);
  const lista = espaco.transacoes
    .filter((t) => t.tipo === tipo && t.data.startsWith(prefixo))
    .sort((a, b) => b.data.localeCompare(a.data));

  // Recebe o resultado da IA e abre o formulário já preenchido p/ conferir
  function abrirRevisao(ai) {
    const ENTRADAS = ["Faturamento", "Salário"];
    const ehRec = ai.tipo === "receita";
    const alvo = (ai.categoria || "").trim().toLowerCase();
    const cat =
      espaco.categorias.find((c) => c.nome.toLowerCase() === alvo) ||
      (alvo &&
        espaco.categorias.find(
          (c) => c.nome.toLowerCase().includes(alvo) || alvo.includes(c.nome.toLowerCase())
        )) ||
      (ehRec
        ? espaco.categorias.find((c) => ENTRADAS.includes(c.nome))
        : espaco.categorias.find((c) => !ENTRADAS.includes(c.nome))) ||
      espaco.categorias[0];
    setForm({
      tipo: ehRec ? "receita" : "despesa",
      data: ai.data || hojeISO(),
      categoriaId: cat?.id || "",
      valor: Number(ai.valor) || 0,
      descricao: ai.descricao || ai.estabelecimento || "",
      status: "ok",
      clienteId: "",
      fornecedorId: "",
      centroCustoId: "",
      comprovante: ai.comprovante || null,
    });
  }
  const catNome = (id) => espaco.categorias.find((c) => c.id === id)?.nome || "—";
  const totalOk = soma(lista.filter((t) => t.status === "ok"));
  const totalPend = soma(lista.filter((t) => t.status === "pendente"));
  const ehReceita = tipo === "receita";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {ehReceita ? "Recebido" : "Pago"}: {fmtBRL(totalOk)}
          </span>
          {totalPend > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Pendente: {fmtBRL(totalPend)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CapturaIA onResultado={abrirRevisao} showToast={showToast} />
          <BotaoPrimario onClick={() => setForm({})}>
            <Plus size={16} /> {ehReceita ? (empresarial ? "Novo faturamento" : "Nova receita") : "Nova despesa"}
          </BotaoPrimario>
        </div>
      </div>

      <Card>
        {lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Nenhum lançamento em {MESES[mesIdx]} de {ano}. Toque em "{ehReceita ? "Nova receita" : "Nova despesa"}" para começar.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lista.map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t.descricao || catNome(t.categoriaId)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fmtData(t.data)} · {catNome(t.categoriaId)}
                  </p>
                </div>
                <ChipStatus status={t.status} tipo={t.tipo} />
                <span
                  className={
                    "w-24 text-right text-sm font-semibold tabular-nums " +
                    (ehReceita ? "text-emerald-600" : "text-slate-700 dark:text-slate-200")
                  }
                >
                  {fmtBRL(t.valor)}
                </span>
                <div className="flex gap-0.5">
                  {t.comprovante && (
                    <button
                      onClick={() => setVerComprovante(t.comprovante)}
                      className="rounded-lg p-1.5 text-emerald-500 transition hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      aria-label="Ver comprovante"
                    >
                      <ImageIcon size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => setForm(t)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                    aria-label="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Excluir este lançamento?")) acoes.excluir(t.id);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                    aria-label="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {form !== null && (
        <FormTransacao
          tipo={tipo}
          inicial={form && Object.keys(form).length ? form : null}
          espaco={espaco}
          empresarial={empresarial}
          onSalvar={acoes.salvar}
          onCriarCategoria={acoes.criarCategoria}
          onFechar={() => setForm(null)}
        />
      )}

      {verComprovante && (
        <Modal titulo="Comprovante" onFechar={() => setVerComprovante(null)}>
          <img src={verComprovante} alt="Comprovante" className="w-full rounded-xl" />
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */

const PIE_COLORS = ["#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#f87171", "#94a3b8", "#60a5fa", "#c084fc"];

function PaginaDashboard({ espaco, ano, mesIdx, escuro, irPara }) {
  const ts = espaco.transacoes;
  const prefixo = mesPrefixo(ano, mesIdx);
  const doMes = ts.filter((t) => t.data.startsWith(prefixo));
  const receitasMes = soma(doMes.filter((t) => t.tipo === "receita" && t.status === "ok"));
  const despesasMes = soma(doMes.filter((t) => t.tipo === "despesa" && t.status === "ok"));
  const lucro = receitasMes - despesasMes;
  // saldo acumulado: tudo que entrou − saiu até o FIM do mês selecionado,
  // carregando o resultado (positivo ou negativo) para os meses seguintes
  const fimMes = prefixo + "-31";
  const saldoAcumulado =
    soma(ts.filter((t) => t.tipo === "receita" && t.status === "ok" && t.data <= fimMes)) -
    soma(ts.filter((t) => t.tipo === "despesa" && t.status === "ok" && t.data <= fimMes));

  // comparação com o mês anterior
  let pa = mesIdx - 1, py = ano;
  if (pa < 0) { pa = 11; py -= 1; }
  const prefAnt = mesPrefixo(py, pa);
  const recAnt = soma(ts.filter((t) => t.tipo === "receita" && t.status === "ok" && t.data.startsWith(prefAnt)));
  const despAnt = soma(ts.filter((t) => t.tipo === "despesa" && t.status === "ok" && t.data.startsWith(prefAnt)));
  const varPct = (atual, ant) =>
    ant > 0 ? `${atual >= ant ? "+" : ""}${(((atual - ant) / ant) * 100).toFixed(0)}% vs ${MESES_CURTO[pa]}` : null;

  // contas próximas do vencimento
  const hoje = hojeISO();
  const em7 = somaDias(hoje, 7);
  const pendentes = ts.filter((t) => t.status === "pendente");
  const vencidas = pendentes.filter((t) => t.data < hoje);
  const proximas = pendentes.filter((t) => t.data >= hoje && t.data <= em7);

  // gráfico de barras — últimos 6 meses
  const barData = [];
  for (let i = 5; i >= 0; i--) {
    let mi = mesIdx - i, y = ano;
    while (mi < 0) { mi += 12; y -= 1; }
    const p = mesPrefixo(y, mi);
    barData.push({
      name: MESES_CURTO[mi] + (y !== ano ? "/" + String(y).slice(2) : ""),
      Entradas: soma(ts.filter((t) => t.tipo === "receita" && t.status === "ok" && t.data.startsWith(p))),
      Saídas: soma(ts.filter((t) => t.tipo === "despesa" && t.status === "ok" && t.data.startsWith(p))),
    });
  }

  // pizza — despesas do mês por categoria
  const porCat = {};
  doMes
    .filter((t) => t.tipo === "despesa" && t.status === "ok")
    .forEach((t) => {
      const nome = espaco.categorias.find((c) => c.id === t.categoriaId)?.nome || "Outros";
      porCat[nome] = (porCat[nome] || 0) + t.valor;
    });
  const pieData = Object.entries(porCat)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Saldo acumulado"
          value={fmtBRL(saldoAcumulado)}
          tone={saldoAcumulado >= 0 ? "default" : "bad"}
          sub={`Tudo até ${MESES_CURTO[mesIdx]}/${ano}, mês a mês`}
        />
        <StatCard icon={TrendingUp} label="Receitas do mês" value={fmtBRL(receitasMes)} sub={varPct(receitasMes, recAnt)} />
        <StatCard icon={TrendingDown} label="Despesas do mês" value={fmtBRL(despesasMes)} sub={varPct(despesasMes, despAnt)} />
        <StatCard
          icon={PiggyBank}
          label="Lucro líquido"
          value={fmtBRL(lucro)}
          tone={lucro > 0 ? "good" : lucro < 0 ? "bad" : "default"}
          sub={`${MESES[mesIdx]} de ${ano}`}
        />
      </div>

      {(vencidas.length > 0 || proximas.length > 0) && (
        <button
          onClick={() => irPara("contas")}
          className="flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-700 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            {vencidas.length > 0 && (
              <b>
                {vencidas.length} conta{vencidas.length > 1 ? "s" : ""} vencida
                {vencidas.length > 1 ? "s" : ""}.{" "}
              </b>
            )}
            {proximas.length > 0 && (
              <>
                {proximas.length} conta{proximas.length > 1 ? "s" : ""} vence
                {proximas.length > 1 ? "m" : ""} nos próximos 7 dias.{" "}
              </>
            )}
            Toque para ver.
          </span>
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Entradas × Saídas (últimos 6 meses)</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={escuro ? "#1e293b" : "#f1f5f9"} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? (v / 1000).toLocaleString("pt-BR") + "k" : v)}
                />
                <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Saídas" fill={escuro ? "#475569" : "#cbd5e1"} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle>Despesas do mês por categoria</SectionTitle>
          <div className="h-64">
            {pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Sem despesas pagas neste mês.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   CONTAS A PAGAR E RECEBER
   ============================================================ */

function PaginaContas({ espaco, acoes }) {
  const hoje = hojeISO();
  const em7 = somaDias(hoje, 7);
  const catNome = (id) => espaco.categorias.find((c) => c.id === id)?.nome || "—";
  const pendentes = (tipo) =>
    espaco.transacoes
      .filter((t) => t.tipo === tipo && t.status === "pendente")
      .sort((a, b) => a.data.localeCompare(b.data));

  function Bloco({ tipo, titulo }) {
    const lista = pendentes(tipo);
    return (
      <Card>
        <SectionTitle right={<span className="text-xs text-slate-400">{fmtBRL(soma(lista))}</span>}>
          {titulo}
        </SectionTitle>
        {lista.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nada pendente. 🎉</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lista.map((t) => {
              const vencida = t.data < hoje;
              const perto = !vencida && t.data <= em7;
              return (
                <div key={t.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {t.descricao || catNome(t.categoriaId)}
                    </p>
                    <p
                      className={
                        "text-xs " +
                        (vencida
                          ? "font-semibold text-red-500"
                          : perto
                          ? "font-semibold text-amber-500"
                          : "text-slate-400")
                      }
                    >
                      {vencida ? "Venceu em " : "Vence em "}
                      {fmtData(t.data)}
                      {perto ? " · próximo!" : ""}
                    </p>
                  </div>
                  <span className="w-24 text-right text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {fmtBRL(t.valor)}
                  </span>
                  <BotaoLeve onClick={() => acoes.marcarOk(t.id)}>
                    <Check size={13} /> {tipo === "receita" ? "Recebi" : "Paguei"}
                  </BotaoLeve>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloco tipo="despesa" titulo="Contas a pagar" />
      <Bloco tipo="receita" titulo="Contas a receber" />
    </div>
  );
}

/* ============================================================
   FLUXO DE CAIXA
   ============================================================ */

function PaginaFluxo({ espaco }) {
  const [periodo, setPeriodo] = useState("mes");
  const [ref, setRef] = useState(hojeISO());
  const catNome = (id) => espaco.categorias.find((c) => c.id === id)?.nome || "—";

  // intervalo [inicio, fim] conforme o período
  const d = new Date(ref + "T12:00:00");
  let inicio, fim, rotulo;
  if (periodo === "dia") {
    inicio = fim = ref;
    rotulo = fmtData(ref);
  } else if (periodo === "semana") {
    const dow = (d.getDay() + 6) % 7; // segunda = 0
    inicio = somaDias(ref, -dow);
    fim = somaDias(inicio, 6);
    rotulo = `${fmtData(inicio)} a ${fmtData(fim)}`;
  } else if (periodo === "ano") {
    inicio = `${d.getFullYear()}-01-01`;
    fim = `${d.getFullYear()}-12-31`;
    rotulo = String(d.getFullYear());
  } else {
    const y = d.getFullYear(), m = d.getMonth();
    inicio = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    fim = `${y}-${String(m + 1).padStart(2, "0")}-31`;
    rotulo = `${MESES[m]} de ${y}`;
  }

  function navegar(delta) {
    if (periodo === "dia") setRef(somaDias(ref, delta));
    else if (periodo === "semana") setRef(somaDias(ref, delta * 7));
    else if (periodo === "ano") {
      const nd = new Date(d); nd.setFullYear(d.getFullYear() + delta);
      setRef(nd.toISOString().slice(0, 10));
    } else {
      const nd = new Date(d.getFullYear(), d.getMonth() + delta, 15);
      setRef(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-15`);
    }
  }

  const ordenadas = [...espaco.transacoes].sort((a, b) => a.data.localeCompare(b.data));
  const saldoInicial = soma(
    ordenadas.filter((t) => t.status === "ok" && t.data < inicio && t.tipo === "receita")
  ) - soma(ordenadas.filter((t) => t.status === "ok" && t.data < inicio && t.tipo === "despesa"));
  const noPeriodo = ordenadas.filter((t) => t.data >= inicio && t.data <= fim);
  let acumulado = saldoInicial;
  const linhas = noPeriodo.map((t) => {
    if (t.status === "ok") acumulado += t.tipo === "receita" ? t.valor : -t.valor;
    return { ...t, acumulado };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]].map(([v, r]) => (
            <button
              key={v}
              onClick={() => setPeriodo(v)}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition " +
                (periodo === v
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400")
              }
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navegar(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-32 text-center text-sm font-medium text-slate-600 dark:text-slate-300">{rotulo}</span>
          <button onClick={() => navegar(1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Próximo">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Wallet} label="Saldo inicial" value={fmtBRL(saldoInicial)} />
        <StatCard
          icon={ArrowLeftRight}
          label="Movimento"
          value={fmtBRL(acumulado - saldoInicial)}
          tone={acumulado - saldoInicial >= 0 ? "good" : "bad"}
        />
        <StatCard icon={PiggyBank} label="Saldo final" value={fmtBRL(acumulado)} tone={acumulado >= 0 ? "default" : "bad"} />
      </div>

      <Card>
        {linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Nenhum lançamento neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400 dark:border-slate-800">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Descrição</th>
                  <th className="py-2 pr-2 text-right">Entrada</th>
                  <th className="py-2 pr-2 text-right">Saída</th>
                  <th className="py-2 text-right">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {linhas.map((t) => (
                  <tr key={t.id} className={t.status === "pendente" ? "opacity-50" : ""}>
                    <td className="py-2 pr-2 tabular-nums text-slate-500">{fmtData(t.data)}</td>
                    <td className="py-2 pr-2 text-slate-700 dark:text-slate-200">
                      {t.descricao || catNome(t.categoriaId)}
                      {t.status === "pendente" && <span className="ml-1 text-xs text-amber-500">(pendente)</span>}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-emerald-600">
                      {t.tipo === "receita" ? fmtBRL(t.valor) : ""}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-red-500">
                      {t.tipo === "despesa" ? fmtBRL(t.valor) : ""}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
                      {t.status === "ok" ? fmtBRL(t.acumulado) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   METAS FINANCEIRAS
   ============================================================ */

function PaginaMetas({ espaco, atualizar }) {
  const [form, setForm] = useState(null);

  function FormMeta({ inicial, onFechar }) {
    const [m, setM] = useState(inicial || { nome: "", alvo: 0, atual: 0 });
    const [erro, setErro] = useState("");
    function salvar(e) {
      e.preventDefault();
      if (!m.nome.trim()) return setErro("Dê um nome para a meta.");
      if (!m.alvo || m.alvo <= 0) return setErro("Digite o valor objetivo.");
      atualizar((esp) => ({
        ...esp,
        metas: m.id
          ? esp.metas.map((x) => (x.id === m.id ? m : x))
          : [...esp.metas, { ...m, id: uid() }],
      }));
      onFechar();
    }
    return (
      <Modal titulo={inicial ? "Editar meta" : "Nova meta"} onFechar={onFechar}>
        <form onSubmit={salvar} className="space-y-3">
          <Campo label="Nome da meta">
            <input
              type="text"
              value={m.nome}
              onChange={(e) => setM({ ...m, nome: e.target.value })}
              placeholder="Ex.: Reserva de emergência, viagem..."
              className={inputCls}
              autoFocus
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor objetivo (R$)">
              <CurrencyField value={m.alvo} onChange={(v) => setM({ ...m, alvo: v })} className="!w-full" />
            </Campo>
            <Campo label="Valor atual (R$)">
              <CurrencyField value={m.atual} onChange={(v) => setM({ ...m, atual: v })} className="!w-full" />
            </Campo>
          </div>
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          <BotaoPrimario className="w-full justify-center">
            <Check size={16} /> Salvar
          </BotaoPrimario>
        </form>
      </Modal>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BotaoPrimario onClick={() => setForm({})}>
          <Plus size={16} /> Nova meta
        </BotaoPrimario>
      </div>
      {espaco.metas.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">
            Nenhuma meta ainda. Crie uma meta de economia e acompanhe o progresso!
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {espaco.metas.map((m) => {
            const pct = m.alvo > 0 ? Math.min(100, (m.atual / m.alvo) * 100) : 0;
            const completa = pct >= 100;
            return (
              <Card key={m.id}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {m.nome} {completa && "🎉"}
                  </p>
                  <div className="flex gap-0.5">
                    <button onClick={() => setForm(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Excluir esta meta?"))
                          atualizar((esp) => ({ ...esp, metas: esp.metas.filter((x) => x.id !== m.id) }));
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                      aria-label="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="mb-2 text-xs text-slate-400">
                  {fmtBRL(m.atual)} de {fmtBRL(m.alvo)} · {pct.toFixed(0)}%
                </p>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={"h-full rounded-full transition-all " + (completa ? "bg-emerald-500" : "bg-emerald-400")}
                    style={{ width: pct + "%" }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {form !== null && <FormMeta inicial={form.id ? form : null} onFechar={() => setForm(null)} />}
    </div>
  );
}

/* ============================================================
   CATEGORIAS
   ============================================================ */

function PaginaCategorias({ espaco, atualizar, avisar }) {
  const [nova, setNova] = useState("");
  const [novaCor, setNovaCor] = useState(null); // null = automática pelo nome
  const [editando, setEditando] = useState(null); // {id, nome}
  const [corAberta, setCorAberta] = useState(null); // id da categoria com a paleta aberta
  const sugestao = gradientePorNome(nova);
  const usos = (id) => espaco.transacoes.filter((t) => t.categoriaId === id).length;
  const totalDe = (id) => soma(espaco.transacoes.filter((t) => t.categoriaId === id));

  function adicionar(e) {
    e.preventDefault();
    const nome = nova.trim();
    if (!nome) return;
    if (espaco.categorias.some((c) => c.nome.toLowerCase() === nome.toLowerCase()))
      return avisar("Essa categoria já existe.", true);
    atualizar((esp) => ({
      ...esp,
      categorias: [...esp.categorias, { id: uid(), nome, cor: novaCor || sugestao.id }],
    }));
    setNova("");
    setNovaCor(null);
  }

  function trocarCor(id, cor) {
    atualizar((esp) => ({
      ...esp,
      categorias: esp.categorias.map((x) => (x.id === id ? { ...x, cor } : x)),
    }));
    setCorAberta(null);
  }

  return (
    <div className="space-y-4">
      {/* --- criador: preview ao vivo + nome + cor --- */}
      <Card>
        <form onSubmit={adicionar} className="space-y-3">
          <div className="flex gap-2.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm transition-all"
              style={{ background: cssGrad(gradPorId(novaCor) || sugestao) }}
            >
              {(nova.trim()[0] || "+").toUpperCase()}
            </div>
            <input
              type="text"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="Nome da nova categoria (ex.: Mercado, Lazer, Salário...)"
              className={inputCls + " flex-1"}
            />
            <BotaoPrimario>
              <Plus size={16} /> Criar
            </BotaoPrimario>
          </div>
          <SeletorGradiente valor={novaCor} sugestao={sugestao} onChange={setNovaCor} />
          <p className="text-[11px] text-slate-400">
            {novaCor
              ? `Cor escolhida: ${gradPorId(novaCor)?.nome}`
              : nova.trim()
                ? `Cor automática pela categoria: ${sugestao.nome} — toque numa bolinha pra trocar`
                : "A cor é escolhida sozinha pelo nome — ou toque numa bolinha pra definir"}
          </p>
        </form>
      </Card>

      {/* --- grade de categorias --- */}
      {espaco.categorias.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">
            Nenhuma categoria ainda. Crie a primeira aí em cima! 🏷️
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {espaco.categorias.map((c) => {
            const g = gradCat(c);
            const n = usos(c.id);
            return (
              <div
                key={c.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
              >
                {/* filete gradiente no topo */}
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: cssGrad(g) }} />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCorAberta(corAberta === c.id ? null : c.id)}
                    title="Trocar cor"
                    aria-label={"Trocar cor de " + c.nome}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm transition hover:scale-105"
                    style={{ background: cssGrad(g) }}
                  >
                    {c.nome.trim()[0]?.toUpperCase() || "?"}
                  </button>
                  <div className="min-w-0 flex-1">
                    {editando?.id === c.id ? (
                      <input
                        type="text"
                        value={editando.nome}
                        onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                        onBlur={() => {
                          const nome = editando.nome.trim();
                          if (nome)
                            atualizar((esp) => ({
                              ...esp,
                              categorias: esp.categorias.map((x) => (x.id === c.id ? { ...x, nome } : x)),
                            }));
                          setEditando(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        className={inputCls + " !py-1.5 w-full"}
                        autoFocus
                      />
                    ) : (
                      <>
                        <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{c.nome}</p>
                        <p className="text-xs text-slate-400">
                          {n} lançamento{n !== 1 ? "s" : ""}
                          {n > 0 && <> · {fmtBRL(totalDe(c.id))}</>}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-60 transition group-hover:opacity-100">
                    <button
                      onClick={() => setCorAberta(corAberta === c.id ? null : c.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                      aria-label="Trocar cor"
                      title="Trocar cor"
                    >
                      <Palette size={14} />
                    </button>
                    <button
                      onClick={() => setEditando({ id: c.id, nome: c.nome })}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                      aria-label="Renomear"
                      title="Renomear"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (usos(c.id) > 0)
                          return avisar("Essa categoria tem lançamentos. Mova-os antes de excluir.", true);
                        atualizar((esp) => ({ ...esp, categorias: esp.categorias.filter((x) => x.id !== c.id) }));
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                      aria-label="Excluir"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {corAberta === c.id && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                    <SeletorGradiente valor={c.cor} sugestao={gradientePorNome(c.nome)} onChange={(cor) => trocarCor(c.id, cor || gradientePorNome(c.nome).id)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CADASTROS EMPRESARIAIS (clientes, fornecedores, centros de custo)
   ============================================================ */

function PaginaCadastro({ titulo, singular, itens, comContato, atualizarLista, extraInfo }) {
  const [form, setForm] = useState(null);

  function FormItem({ inicial, onFechar }) {
    const [it, setIt] = useState(inicial || { nome: "", telefone: "", email: "", obs: "" });
    const [erro, setErro] = useState("");
    function salvar(e) {
      e.preventDefault();
      if (!it.nome.trim()) return setErro("Digite o nome.");
      atualizarLista((lista) =>
        it.id ? lista.map((x) => (x.id === it.id ? it : x)) : [...lista, { ...it, id: uid() }]
      );
      onFechar();
    }
    return (
      <Modal titulo={(inicial ? "Editar " : "Novo ") + singular} onFechar={onFechar}>
        <form onSubmit={salvar} className="space-y-3">
          <Campo label="Nome">
            <input type="text" value={it.nome} onChange={(e) => setIt({ ...it, nome: e.target.value })} className={inputCls} autoFocus />
          </Campo>
          {comContato && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Telefone">
                  <input type="tel" value={it.telefone || ""} onChange={(e) => setIt({ ...it, telefone: e.target.value })} className={inputCls} />
                </Campo>
                <Campo label="E-mail">
                  <input type="email" value={it.email || ""} onChange={(e) => setIt({ ...it, email: e.target.value })} className={inputCls} />
                </Campo>
              </div>
              <Campo label="Observações">
                <input type="text" value={it.obs || ""} onChange={(e) => setIt({ ...it, obs: e.target.value })} className={inputCls} />
              </Campo>
            </>
          )}
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          <BotaoPrimario className="w-full justify-center">
            <Check size={16} /> Salvar
          </BotaoPrimario>
        </form>
      </Modal>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BotaoPrimario onClick={() => setForm({})}>
          <Plus size={16} /> {"Novo " + singular}
        </BotaoPrimario>
      </div>
      <Card>
        {itens.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Nenhum cadastro ainda.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {itens.map((it) => (
              <div key={it.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{it.nome}</p>
                  <p className="truncate text-xs text-slate-400">
                    {extraInfo
                      ? extraInfo(it)
                      : [it.telefone, it.email, it.obs].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <button onClick={() => setForm(it)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Editar">
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir ${it.nome}?`))
                      atualizarLista((lista) => lista.filter((x) => x.id !== it.id));
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
                  aria-label="Excluir"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
      {form !== null && <FormItem inicial={form.id ? form : null} onFechar={() => setForm(null)} />}
    </div>
  );
}

/* ============================================================
   RELATÓRIOS
   ============================================================ */

function PaginaRelatorios({ espaco, empresarial, ano, mesIdx, nomeApp }) {
  const [aba, setAba] = useState("mensal");
  const catNome = (id) => espaco.categorias.find((c) => c.id === id)?.nome || "Outros";
  const ts = espaco.transacoes.filter((t) => t.status === "ok");

  // ---- dados mensais ----
  const prefixo = mesPrefixo(ano, mesIdx);
  const doMes = ts.filter((t) => t.data.startsWith(prefixo));
  const recMes = soma(doMes.filter((t) => t.tipo === "receita"));
  const despMes = soma(doMes.filter((t) => t.tipo === "despesa"));
  const porCategoria = (lista, tipo) => {
    const r = {};
    lista.filter((t) => t.tipo === tipo).forEach((t) => {
      const n = catNome(t.categoriaId);
      r[n] = (r[n] || 0) + t.valor;
    });
    return Object.entries(r).sort((a, b) => b[1] - a[1]);
  };
  const recPorCat = porCategoria(doMes, "receita");
  const despPorCat = porCategoria(doMes, "despesa");

  // centro de custos (empresarial)
  const porCentro = {};
  if (empresarial) {
    doMes.filter((t) => t.tipo === "despesa").forEach((t) => {
      const n = espaco.centrosCusto.find((c) => c.id === t.centroCustoId)?.nome || "Sem centro";
      porCentro[n] = (porCentro[n] || 0) + t.valor;
    });
  }

  // ---- dados anuais ----
  // saldo que vem dos anos anteriores (carrega resultado, mesmo negativo)
  const saldoAnterior =
    soma(ts.filter((t) => t.tipo === "receita" && t.data < `${ano}-01-01`)) -
    soma(ts.filter((t) => t.tipo === "despesa" && t.data < `${ano}-01-01`));
  let acumulado = saldoAnterior;
  const anual = MESES.map((nome, i) => {
    const p = mesPrefixo(ano, i);
    const rec = soma(ts.filter((t) => t.tipo === "receita" && t.data.startsWith(p)));
    const desp = soma(ts.filter((t) => t.tipo === "despesa" && t.data.startsWith(p)));
    acumulado += rec - desp;
    return { nome, rec, desp, lucro: rec - desp, acumulado };
  });
  const totAnualRec = anual.reduce((a, m) => a + m.rec, 0);
  const totAnualDesp = anual.reduce((a, m) => a + m.desp, 0);

  function htmlTabela(cabecalho, linhas, totalLinha) {
    return `<table><thead><tr>${cabecalho.map((c, i) => `<th class="${i > 0 ? "num" : ""}">${escHtml(c)}</th>`).join("")}</tr></thead><tbody>${linhas
      .map((l) => `<tr>${l.map((c, i) => `<td class="${i > 0 ? "num" : ""}">${escHtml(c)}</td>`).join("")}</tr>`)
      .join("")}${totalLinha ? `<tr class="total">${totalLinha.map((c, i) => `<td class="${i > 0 ? "num" : ""}">${escHtml(c)}</td>`).join("")}</tr>` : ""}</tbody></table>`;
  }

  function exportar(formato) {
    const escopo = empresarial ? "Empresarial" : "Pessoal";
    if (aba === "mensal") {
      const titulo = `Relatório mensal — ${MESES[mesIdx]} de ${ano} (${escopo})`;
      if (formato === "pdf") {
        const corpo = `<h1>${nomeApp}</h1><p class="sub">${titulo}</p>
<h2>Resumo</h2>${htmlTabela(["", "Valor"], [["Receitas", fmtBRL(recMes)], ["Despesas", fmtBRL(despMes)]], ["Lucro líquido", fmtBRL(recMes - despMes)])}
<h2>Receitas por categoria</h2>${htmlTabela(["Categoria", "Valor"], recPorCat.map(([n, v]) => [n, fmtBRL(v)]), ["Total", fmtBRL(recMes)])}
<h2>Despesas por categoria</h2>${htmlTabela(["Categoria", "Valor"], despPorCat.map(([n, v]) => [n, fmtBRL(v)]), ["Total", fmtBRL(despMes)])}
${empresarial ? `<h2>Despesas por centro de custo</h2>${htmlTabela(["Centro de custo", "Valor"], Object.entries(porCentro).map(([n, v]) => [n, fmtBRL(v)]), null)}<h2>Lucro operacional</h2>${htmlTabela(["", "Valor"], [["Faturamento", fmtBRL(recMes)], ["Despesas operacionais", fmtBRL(despMes)]], ["Lucro operacional", fmtBRL(recMes - despMes)])}` : ""}`;
        exportarPDF(titulo, corpo);
      } else {
        const linhas = [
          [titulo], [],
          ["RESUMO"], ["Receitas", fmtNum(recMes)], ["Despesas", fmtNum(despMes)], ["Lucro líquido", fmtNum(recMes - despMes)], [],
          ["RECEITAS POR CATEGORIA"], ...recPorCat.map(([n, v]) => [n, fmtNum(v)]), [],
          ["DESPESAS POR CATEGORIA"], ...despPorCat.map(([n, v]) => [n, fmtNum(v)]),
        ];
        if (empresarial) {
          linhas.push([], ["DESPESAS POR CENTRO DE CUSTO"], ...Object.entries(porCentro).map(([n, v]) => [n, fmtNum(v)]));
        }
        linhas.push([], ["LANÇAMENTOS DO MÊS"], ["Data", "Tipo", "Categoria", "Descrição", "Valor"]);
        doMes
          .sort((a, b) => a.data.localeCompare(b.data))
          .forEach((t) =>
            linhas.push([fmtData(t.data), t.tipo === "receita" ? "Receita" : "Despesa", catNome(t.categoriaId), t.descricao || "", fmtNum(t.valor)])
          );
        exportarExcel(`relatorio-${escopo.toLowerCase()}-${prefixo}`, linhas);
      }
    } else {
      const titulo = `Relatório anual — ${ano} (${escopo})`;
      if (formato === "pdf") {
        const corpo = `<h1>${nomeApp}</h1><p class="sub">${titulo}</p>
${saldoAnterior !== 0 ? `<p class="sub">Saldo vindo dos anos anteriores: ${fmtBRL(saldoAnterior)}</p>` : ""}
${htmlTabela(["Mês", "Receitas", "Despesas", "Lucro", "Acumulado"], anual.map((m) => [m.nome, fmtBRL(m.rec), fmtBRL(m.desp), fmtBRL(m.lucro), fmtBRL(m.acumulado)]), ["Total", fmtBRL(totAnualRec), fmtBRL(totAnualDesp), fmtBRL(totAnualRec - totAnualDesp), fmtBRL(anual[11].acumulado)])}`;
        exportarPDF(titulo, corpo);
      } else {
        exportarExcel(`relatorio-${escopo.toLowerCase()}-${ano}`, [
          [titulo], [],
          ["Mês", "Receitas", "Despesas", "Lucro", "Acumulado"],
          ...anual.map((m) => [m.nome, fmtNum(m.rec), fmtNum(m.desp), fmtNum(m.lucro), fmtNum(m.acumulado)]),
          ["Total", fmtNum(totAnualRec), fmtNum(totAnualDesp), fmtNum(totAnualRec - totAnualDesp), fmtNum(anual[11].acumulado)],
        ]);
      }
    }
  }

  const TabelaCat = ({ titulo, dados, total, cor }) => (
    <Card>
      <SectionTitle right={<span className={"text-xs font-bold " + cor}>{fmtBRL(total)}</span>}>{titulo}</SectionTitle>
      {dados.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Nada neste mês.</p>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {dados.map(([n, v]) => (
            <div key={n} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{n}</span>
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">{fmtBRL(v)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {[["mensal", "Mensal"], ["anual", "Anual"]].map(([v, r]) => (
            <button
              key={v}
              onClick={() => setAba(v)}
              className={
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition " +
                (aba === v
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400")
              }
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <BotaoLeve onClick={() => exportar("pdf")}>
            <Printer size={14} /> PDF
          </BotaoLeve>
          <BotaoLeve onClick={() => exportar("excel")}>
            <FileSpreadsheet size={14} /> Excel
          </BotaoLeve>
        </div>
      </div>

      {aba === "mensal" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={TrendingUp} label="Receitas" value={fmtBRL(recMes)} />
            <StatCard icon={TrendingDown} label="Despesas" value={fmtBRL(despMes)} />
            <StatCard
              icon={PiggyBank}
              label={empresarial ? "Lucro operacional" : "Lucro líquido"}
              value={fmtBRL(recMes - despMes)}
              tone={recMes - despMes >= 0 ? "good" : "bad"}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TabelaCat titulo="Receitas por categoria" dados={recPorCat} total={recMes} cor="text-emerald-600" />
            <TabelaCat titulo="Despesas por categoria" dados={despPorCat} total={despMes} cor="text-red-500" />
          </div>
          {empresarial && Object.keys(porCentro).length > 0 && (
            <TabelaCat
              titulo="Despesas por centro de custo"
              dados={Object.entries(porCentro).sort((a, b) => b[1] - a[1])}
              total={despMes}
              cor="text-red-500"
            />
          )}
        </>
      ) : (
        <Card>
          <SectionTitle>Resultado de {ano}, mês a mês</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-400 dark:border-slate-800">
                  <th className="py-2 pr-2">Mês</th>
                  <th className="py-2 pr-2 text-right">Receitas</th>
                  <th className="py-2 pr-2 text-right">Despesas</th>
                  <th className="py-2 pr-2 text-right">Lucro</th>
                  <th className="py-2 text-right">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {anual.map((m) => (
                  <tr key={m.nome}>
                    <td className="py-2 pr-2 text-slate-600 dark:text-slate-300">{m.nome}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-emerald-600">{m.rec ? fmtBRL(m.rec) : "—"}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-red-500">{m.desp ? fmtBRL(m.desp) : "—"}</td>
                    <td
                      className={
                        "py-2 pr-2 text-right font-medium tabular-nums " +
                        (m.lucro > 0 ? "text-emerald-600" : m.lucro < 0 ? "text-red-500" : "text-slate-400")
                      }
                    >
                      {m.rec || m.desp ? fmtBRL(m.lucro) : "—"}
                    </td>
                    <td
                      className={
                        "py-2 text-right font-semibold tabular-nums " +
                        (m.acumulado >= 0 ? "text-slate-700 dark:text-slate-200" : "text-red-500")
                      }
                    >
                      {fmtBRL(m.acumulado)}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2 pr-2 text-slate-700 dark:text-slate-200">Total</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-emerald-600">{fmtBRL(totAnualRec)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-red-500">{fmtBRL(totAnualDesp)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                    {fmtBRL(totAnualRec - totAnualDesp)}
                  </td>
                  <td
                    className={
                      "py-2 text-right tabular-nums " +
                      (anual[11].acumulado >= 0 ? "text-slate-700 dark:text-slate-200" : "text-red-500")
                    }
                  >
                    {fmtBRL(anual[11].acumulado)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            O "Acumulado" carrega o resultado de cada mês para o seguinte, mesmo quando negativo
            {saldoAnterior !== 0 ? `, incluindo ${fmtBRL(saldoAnterior)} vindos dos anos anteriores` : ""}.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   TELA DE LOGIN (primeiro uso + bloqueio opcional por PIN)
   ============================================================ */

function CampoLogin({ label, ...props }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <input {...props} className={inputCls} />
    </div>
  );
}

// Campo de formulário da TelaAuth: rótulo + ícone à esquerda e, se for
// senha, um "olho" à direita para mostrar/ocultar.
function CampoAuth({ label, icon: Icon, type = "text", value, onChange, placeholder, senha }) {
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
function TelaAuth() {
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
function TelaNovaSenha({ onPronto }) {
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

function TelaLogin({ modo, nome, foto, onCriar, onDesbloquear, onEsqueci, onBiometria, temBio, escuro, onTema }) {
  const [nomeInput, setNomeInput] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pedirSempre, setPedirSempre] = useState(true);
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [fotoNova, setFotoNova] = useState(null);
  const [arquivoCrop, setArquivoCrop] = useState(null);
  const fotoRef = useRef(null);

  const pinValido = (p) => /^\d{4,6}$/.test(p);

  async function criar(e) {
    e.preventDefault();
    if (!nomeInput.trim()) return setErro("Digite como você quer ser chamada.");
    if (!pinValido(pin)) return setErro("O PIN precisa ter de 4 a 6 números.");
    if (pin !== pin2) return setErro("Os dois PINs não são iguais. Tente de novo.");
    setErro("");
    await onCriar(nomeInput.trim(), pin, pedirSempre, fotoNova);
  }

  async function desbloquear(e) {
    e.preventDefault();
    if (!pinValido(pin)) return setErro("Digite o PIN (4 a 6 números).");
    setVerificando(true);
    const ok = await onDesbloquear(pin);
    setVerificando(false);
    if (!ok) {
      setPin("");
      setErro("PIN incorreto. Tente de novo.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <button
        onClick={onTema}
        aria-label="Alternar modo claro/escuro"
        className="fixed right-4 top-4 rounded-full border border-slate-200 bg-white p-2.5 text-slate-400 transition hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:text-slate-300"
      >
        {escuro ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-6 flex flex-col items-center text-center">
          {modo === "lock" && foto ? (
            <img src={foto} alt="" className="mb-3 h-20 w-20 rounded-full border-2 border-emerald-500 object-cover" />
          ) : modo === "lock" ? (
            <img src={emblemaUrl} alt="" className="mb-3 h-20 w-20 object-contain" />
          ) : (
            <div className="mb-2 rounded-2xl bg-white px-4 py-2">
              <img src={logoUrl} alt="" className="h-28 object-contain" />
            </div>
          )}
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {modo === "lock" ? `Olá, ${nome}!` : "Bem-vinda ao Thayfinance"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {modo === "lock" ? "Digite seu PIN para entrar" : "Vamos preparar seu app em 10 segundos"}
          </p>
        </div>

        {modo === "setup" ? (
          <form onSubmit={criar} className="space-y-4">
            <input
              ref={fotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setArquivoCrop(f);
                e.target.value = "";
              }}
            />
            {arquivoCrop && (
              <CropFotoModal
                file={arquivoCrop}
                onConfirmar={(d) => {
                  setFotoNova(d);
                  setArquivoCrop(null);
                }}
                onFechar={() => setArquivoCrop(null)}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <button type="button" onClick={() => fotoRef.current?.click()} aria-label="Escolher foto" className="transition hover:opacity-80">
                {fotoNova ? (
                  <img src={fotoNova} alt="" className="h-20 w-20 rounded-full border-2 border-emerald-500 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 dark:border-slate-600">
                    <Camera size={24} />
                  </div>
                )}
              </button>
              <span className="text-xs text-slate-400">Foto (opcional) — toque para escolher</span>
            </div>
            <CampoLogin
              label="Como você quer ser chamada?"
              type="text"
              value={nomeInput}
              onChange={(e) => setNomeInput(e.target.value)}
              placeholder="Seu nome"
            />
            <CampoLogin
              label="Crie um PIN (4 a 6 números)"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
            />
            <CampoLogin
              label="Repita o PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
            />
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={pedirSempre}
                onChange={(e) => setPedirSempre(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              Proteger com PIN (pede a cada 1 hora)
            </label>
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            <button type="submit" className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
              Começar
            </button>
            <p className="text-center text-xs text-slate-400">O PIN fica guardado só neste aparelho.</p>
          </form>
        ) : (
          <form onSubmit={desbloquear} className="space-y-4">
            {temBio && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    setErro("");
                    const ok = await onBiometria();
                    if (!ok) setErro("Não reconheci. Você pode entrar com o PIN abaixo.");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <ScanFace size={18} /> Entrar com Face ID / digital
                </button>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  ou use o PIN
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>
              </>
            )}
            <CampoLogin
              label="Seu PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              autoFocus={!temBio}
            />
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            <button
              type="submit"
              disabled={verificando}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {verificando ? "Verificando..." : "Entrar"}
            </button>
            <button type="button" onClick={onEsqueci} className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:underline">
              Esqueci o PIN
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   APP PRINCIPAL
   ============================================================ */

const NAV_PESSOAL = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "receitas", label: "Receitas", icon: TrendingUp },
  { id: "despesas", label: "Despesas", icon: TrendingDown },
  { id: "contas", label: "Contas a Pagar/Receber", icon: CalendarClock },
  { id: "fluxo", label: "Fluxo de Caixa", icon: ArrowLeftRight },
  { id: "metas", label: "Metas", icon: Target },
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "relatorios", label: "Relatórios", icon: FileText },
  { id: "conta", label: "Conta", icon: User },
];
const NAV_EMPRESA = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "receitas", label: "Faturamento", icon: TrendingUp },
  { id: "despesas", label: "Despesas", icon: TrendingDown },
  { id: "contas", label: "Contas a Pagar/Receber", icon: CalendarClock },
  { id: "fluxo", label: "Fluxo de Caixa", icon: ArrowLeftRight },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "fornecedores", label: "Fornecedores", icon: Truck },
  { id: "centros", label: "Centro de Custos", icon: FolderOpen },
  { id: "metas", label: "Metas", icon: Target },
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "relatorios", label: "Relatórios", icon: FileText },
  { id: "conta", label: "Conta", icon: User },
];

// Aba "Minha Conta": mostra quem está logado, ONDE os dados ficam (nuvem x
// aparelho) e o status do Telegram. Ajuda a entender por que o saldo pode
// parecer diferente entre o computador e o celular.
function PaginaConta({ login, sessao, userId, onConectarTelegram, onLimparDados, onSair, showToast }) {
  const email = sessao?.user?.email || null;
  const naNuvem = !!sessao;
  const [tg, setTg] = useState(undefined); // undefined=carregando | null=não | obj=sim
  const [alvoLimpar, setAlvoLimpar] = useState("pessoal"); // qual espaço limpar
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);

  function limpar() {
    onLimparDados?.(alvoLimpar);
    setConfirmandoLimpar(false);
    showToast?.(`Dados ${alvoLimpar === "empresarial" ? "empresariais" : "pessoais"} apagados.`);
  }

  useEffect(() => {
    let vivo = true;
    if (userId) {
      statusTelegram(userId).then((v) => vivo && setTg(v)).catch(() => vivo && setTg(null));
    } else {
      setTg(null);
    }
    return () => {
      vivo = false;
    };
  }, [userId]);

  const Linha = ({ rotulo, children }) => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{rotulo}</span>
      <span className="text-right text-sm font-medium text-slate-800 dark:text-slate-100">{children}</span>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      {/* Cartão do perfil */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {login?.foto ? (
          <img src={login.foto} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {(login?.nome || email || "?").trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">{login?.nome || "Minha conta"}</p>
          <p className="truncate text-sm text-slate-400">{email || "Conta local (sem nuvem)"}</p>
        </div>
      </div>

      {/* Onde ficam os dados */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-1 text-sm font-bold text-slate-700 dark:text-slate-200">Seus dados</h3>
        <Linha rotulo="Onde ficam guardados">
          {naNuvem ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Cloud size={14} /> Na nuvem
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Lock size={14} /> Só neste aparelho
            </span>
          )}
        </Linha>
        <Linha rotulo="E-mail da conta">{email || "—"}</Linha>
        <Linha rotulo="Identificador">
          <span className="font-mono text-xs text-slate-400">{userId ? userId.slice(0, 8) + "…" : "—"}</span>
        </Linha>
      </div>

      {/* Telegram */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Bot do Telegram</h3>
            <p className="mt-0.5 text-sm text-slate-400">
              {tg === undefined ? "Verificando..." : tg ? "Conectado ✅" : "Não conectado"}
            </p>
          </div>
          {userId && (
            <button
              onClick={onConectarTelegram}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              <Send size={15} /> {tg ? "Gerenciar" : "Conectar"}
            </button>
          )}
        </div>
      </div>

      {/* Explicação do saldo diferente entre aparelhos */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">O saldo aqui está diferente do celular?</p>
          <p className="text-amber-700/90 dark:text-amber-300/80">
            Cada aparelho mostra os dados de <b>onde ele está ligado</b>. Se um aparelho está{" "}
            <b>na nuvem</b> e o outro guarda os dados <b>só no próprio aparelho</b>, os saldos vão
            parecer diferentes. Para os dois baterem, entre com a <b>mesma conta</b> nos dois e use{" "}
            <b>Importar dados</b> para enviar o que estava só no aparelho para a nuvem.
          </p>
        </div>
      </div>

      {/* Zona de perigo — limpar dados de um espaço */}
      <div className="rounded-2xl border border-red-200 bg-white p-5 dark:border-red-900/60 dark:bg-slate-900">
        <h3 className="flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400">
          <Trash2 size={16} /> Limpar dados
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Apaga <b>todos</b> os dados do espaço escolhido (lançamentos, metas, clientes,
          fornecedores e centros de custo). As categorias voltam ao padrão. <b>Não dá pra desfazer.</b>
        </p>

        {/* escolher o espaço */}
        <div className="mt-4 flex gap-2">
          {[
            { id: "pessoal", label: "Pessoal", icon: User },
            { id: "empresarial", label: "Empresarial", icon: Briefcase },
          ].map((o) => {
            const ativo = alvoLimpar === o.id;
            return (
              <button
                key={o.id}
                onClick={() => {
                  setAlvoLimpar(o.id);
                  setConfirmandoLimpar(false);
                }}
                className={
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition " +
                  (ativo
                    ? "border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800")
                }
              >
                <o.icon size={15} /> {o.label}
              </button>
            );
          })}
        </div>

        {/* ação + confirmação */}
        {!confirmandoLimpar ? (
          <button
            onClick={() => setConfirmandoLimpar(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 size={15} /> Limpar dados {alvoLimpar === "empresarial" ? "empresariais" : "pessoais"}
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
            <p className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Tem certeza? Isso vai apagar <b>todos</b> os dados{" "}
              <b>{alvoLimpar === "empresarial" ? "Empresariais" : "Pessoais"}</b> de forma permanente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmandoLimpar(false)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={limpar}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Sim, apagar tudo
              </button>
            </div>
          </div>
        )}
      </div>

      {onSair && (
        <button
          onClick={onSair}
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <LogOut size={16} /> Sair da conta
        </button>
      )}
    </div>
  );
}

// Conectar o bot do Telegram à conta: o app gera um código de 6 números,
// a pessoa manda "/conectar 123456" no bot e o vínculo é criado sozinho.
function ModalConectarTelegram({ userId, nome, onFechar, showToast }) {
  const [carregando, setCarregando] = useState(true);
  const [vinculo, setVinculo] = useState(null); // { chat_id } se já conectado
  const [codigo, setCodigo] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    statusTelegram(userId)
      .then((v) => vivo && setVinculo(v))
      .catch(() => {})
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [userId]);

  async function gerar() {
    setGerando(true);
    try {
      const { codigo } = await gerarCodigoTelegram(userId, nome);
      setCodigo(codigo);
    } catch (e) {
      showToast(e?.message || "Não consegui gerar o código.", true, 5000);
    } finally {
      setGerando(false);
    }
  }

  async function desconectar() {
    if (!window.confirm("Desligar o Telegram desta conta? Você pode reconectar quando quiser.")) return;
    try {
      await desconectarTelegram(userId);
      setVinculo(null);
      setCodigo(null);
      showToast("Telegram desconectado.");
    } catch {
      showToast("Não consegui desconectar agora.", true);
    }
  }

  function copiarComando() {
    const texto = `/conectar ${codigo}`;
    navigator.clipboard?.writeText(texto).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      },
      () => {},
    );
  }

  return (
    <Modal titulo="Conectar Telegram" onFechar={onFechar}>
      {carregando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 size={18} className="animate-spin" /> Carregando...
        </div>
      ) : vinculo ? (
        // ---- JÁ CONECTADO ----
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/50">
            <Check size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Telegram conectado ✅</p>
              <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-400/70">
                Mande áudio, foto de comprovante ou uma mensagem pro bot que eu lanço aqui na sua conta.
              </p>
            </div>
          </div>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Send size={16} /> Abrir o bot no Telegram
          </a>
          <button
            onClick={desconectar}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            Desconectar
          </button>
        </div>
      ) : (
        // ---- NÃO CONECTADO ----
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <Send size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Lance seus gastos por <b>áudio</b>, <b>foto do comprovante</b> ou <b>mensagem</b>, direto no Telegram.
              É rapidinho conectar:
            </p>
          </div>

          {!codigo ? (
            <button
              onClick={gerar}
              disabled={gerando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {gerando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Gerar código de conexão
            </button>
          ) : (
            <div className="space-y-4">
              <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">1</span>
                  <span>
                    Abra o bot{" "}
                    <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 underline underline-offset-2 dark:text-emerald-400">
                      @{BOT_USERNAME}
                    </a>{" "}
                    no Telegram.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">2</span>
                  <span>Envie a mensagem abaixo pra ele:</span>
                </li>
              </ol>

              <button
                onClick={copiarComando}
                title="Toque para copiar"
                className="flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 px-4 py-3 text-left transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
              >
                <span className="font-mono text-lg font-bold tracking-wide text-slate-800 dark:text-slate-100">
                  /conectar {codigo}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {copiado ? <Check size={14} /> : <Copy size={14} />}
                  {copiado ? "Copiado" : "Copiar"}
                </span>
              </button>

              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Send size={16} /> Abrir o bot no Telegram
              </a>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>O código vale por 15 minutos.</span>
                <button onClick={gerar} disabled={gerando} className="flex items-center gap-1 underline-offset-2 hover:underline disabled:opacity-60">
                  <RefreshCw size={12} className={gerando ? "animate-spin" : ""} /> Gerar outro
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

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
    salvar: (t) =>
      atualizarEspaco((esp) => ({
        ...esp,
        transacoes: t.id
          ? esp.transacoes.map((x) => (x.id === t.id ? t : x))
          : [...esp.transacoes, { ...t, id: uid() }],
      })),
    excluir: (id) =>
      atualizarEspaco((esp) => ({ ...esp, transacoes: esp.transacoes.filter((x) => x.id !== id) })),
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
        const parsed = JSON.parse(reader.result);
        dados = normalizarDados(parsed);
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
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thayfinance-${new Date().toISOString().slice(0, 10)}.json`;
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
              {view === "contas" && <PaginaContas espaco={espaco} acoes={acoesTransacao} />}
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
