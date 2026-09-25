import { Home, ListOrdered, CalendarClock, ArrowLeftRight, Target, Tags, FileText, Users, Truck, FolderOpen, ShieldCheck } from "lucide-react";

/* ============================================================
   NAVEGAÇÃO
   Celular: barra de baixo com 4 destinos + botão "+" no meio; o resto
   fica em "Mais". Computador: barra lateral com tudo.
   ============================================================ */

const BASE = [
  { id: "dashboard", label: "Início", icon: Home },
  { id: "lancamentos", label: "Lançamentos", icon: ListOrdered },
  { id: "contas", label: "Contas a pagar e receber", curto: "Contas", icon: CalendarClock },
  { id: "fluxo", label: "Fluxo de caixa", icon: ArrowLeftRight },
];
const FIM = [
  { id: "metas", label: "Metas", icon: Target },
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "relatorios", label: "Relatórios", icon: FileText },
  { id: "conta", label: "Conta e segurança", icon: ShieldCheck },
];

export const NAV_PESSOAL = [...BASE, ...FIM];
export const NAV_EMPRESA = [
  ...BASE,
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "fornecedores", label: "Fornecedores", icon: Truck },
  { id: "centros", label: "Centros de custo", icon: FolderOpen },
  ...FIM,
];

// Páginas que moram dentro de "Mais" no celular (ganham botão de voltar)
export const DENTRO_DE_MAIS = ["fluxo", "metas", "categorias", "relatorios", "clientes", "fornecedores", "centros", "conta"];

// Aba da barra de baixo que fica acesa para cada página
export const abaDe = (view) =>
  view === "dashboard" || view === "lancamentos" || view === "contas" ? view : "mais";

// Páginas que dependem do mês escolhido
export const USA_MES = ["dashboard", "lancamentos", "relatorios"];

export const TITULOS = {
  dashboard: "Início",
  lancamentos: "Lançamentos",
  contas: "Contas",
  fluxo: "Fluxo de caixa",
  metas: "Metas",
  categorias: "Categorias",
  relatorios: "Relatórios",
  clientes: "Clientes",
  fornecedores: "Fornecedores",
  centros: "Centros de custo",
  conta: "Conta e segurança",
  mais: "Mais",
};
