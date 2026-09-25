import { Home, ListOrdered, CalendarClock, ArrowLeftRight, Target, Tags, FileText, Users, Truck, FolderOpen, UserCog } from "lucide-react";

/* ============================================================
   NAVEGAÇÃO
   Celular: barra de baixo com 4 destinos + botão "+" no meio.
   "Mais" = ferramentas de finanças. Perfil e configurações abrem pela
   foto no topo. Computador: barra lateral com tudo.
   ============================================================ */

const BASE = [
  { id: "dashboard", label: "Início", icon: Home },
  { id: "lancamentos", label: "Lançamentos", icon: ListOrdered },
  { id: "contas", label: "Contas a pagar e receber", icon: CalendarClock },
  { id: "fluxo", label: "Fluxo de caixa", icon: ArrowLeftRight },
];
const FIM = [
  { id: "metas", label: "Metas", icon: Target },
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "relatorios", label: "Relatórios", icon: FileText },
  { id: "perfil", label: "Perfil e configurações", icon: UserCog },
];

export const NAV_PESSOAL = [...BASE, ...FIM];
export const NAV_EMPRESA = [
  ...BASE,
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "fornecedores", label: "Fornecedores", icon: Truck },
  { id: "centros", label: "Centros de custo", icon: FolderOpen },
  ...FIM,
];

// De onde cada página "vem" no celular (o botão voltar leva pra lá)
export const PAI = {
  fluxo: "mais",
  metas: "mais",
  categorias: "mais",
  relatorios: "mais",
  clientes: "mais",
  fornecedores: "mais",
  centros: "mais",
  perfil: "dashboard",
  conta: "perfil",
};

// Aba da barra de baixo que fica acesa para cada página
export const abaDe = (view) =>
  view === "dashboard" || view === "lancamentos" || view === "contas" || view === "mais"
    ? view
    : PAI[view] === "mais"
    ? "mais"
    : null;

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
  conta: "Dados e notificações",
  perfil: "Perfil",
  mais: "Mais",
};
