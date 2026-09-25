import { LayoutDashboard, TrendingUp, TrendingDown, CalendarClock, ArrowLeftRight, Target, Tags, FileText, Users, Truck, FolderOpen, User } from "lucide-react";

/* ============================================================
   APP PRINCIPAL
   ============================================================ */

export const NAV_PESSOAL = [
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
export const NAV_EMPRESA = [
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
