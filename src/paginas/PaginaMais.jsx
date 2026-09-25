import React from "react";
import {
  ArrowLeftRight, Target, FileText, Tags, Users, Truck, FolderOpen, Send, Download, Upload, Moon, Sun,
  ScanFace, ShieldCheck, LogOut, ChevronRight, Camera, User, Briefcase, Lightbulb,
} from "lucide-react";

/* ============================================================
   MAIS — tudo que não cabe na barra de baixo, com rótulos claros.
   Linhas de 56px; "Sair" separado no fim (pede confirmação).
   ============================================================ */

export function PaginaMais({
  login, email, modo, trocarModo, irPara, escuro, alternarTema, bioDisponivel, bioAtivo, alternarBiometria,
  onTelegram, onExportar, onImportar, onTrocarFoto, onSair, onVerTour, userId,
}) {
  const empresarial = modo === "empresarial";
  const nome = login?.nome || "Minha conta";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Perfil */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <button type="button" onClick={onTrocarFoto} className="relative shrink-0" aria-label="Trocar foto do perfil">
          {login?.foto ? (
            <img src={login.foto} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {nome.trim()[0]?.toUpperCase() || "?"}
            </span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-white dark:border-slate-900">
            <Camera size={12} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">{nome}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{email || "Dados só neste aparelho"}</p>
        </div>
      </div>

      {/* Espaço */}
      <div>
        <Titulo>Espaço</Titulo>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Espaço">
          {[
            ["pessoal", "Pessoal", User, "Casa e contas pessoais"],
            ["empresarial", "Empresarial", Briefcase, "Negócio e clientes"],
          ].map(([v, r, Icone, desc]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={modo === v}
              onClick={() => trocarModo(v)}
              className={
                "flex min-h-16 flex-col items-start justify-center rounded-2xl border px-4 py-3 text-left transition " +
                (modo === v
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500 dark:bg-emerald-950 dark:text-emerald-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200")
              }
            >
              <span className="flex items-center gap-2 text-base font-semibold">
                <Icone size={17} /> {r}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <Grupo titulo="Finanças">
        <Item icone={ArrowLeftRight} onClick={() => irPara("fluxo")} desc="Saldo dia a dia">Fluxo de caixa</Item>
        <Item icone={Target} onClick={() => irPara("metas")} desc="Reservas e objetivos">Metas</Item>
        <Item icone={FileText} onClick={() => irPara("relatorios")} desc="Mensal, anual, PDF e Excel">Relatórios</Item>
        <Item icone={Tags} onClick={() => irPara("categorias")} desc="Nomes e cores">Categorias</Item>
      </Grupo>

      {empresarial && (
        <Grupo titulo="Empresa">
          <Item icone={Users} onClick={() => irPara("clientes")}>Clientes</Item>
          <Item icone={Truck} onClick={() => irPara("fornecedores")}>Fornecedores</Item>
          <Item icone={FolderOpen} onClick={() => irPara("centros")}>Centros de custo</Item>
        </Grupo>
      )}

      <Grupo titulo="App">
        <Item icone={ShieldCheck} onClick={() => irPara("conta")} desc="Onde ficam os dados, notificações, limpar dados">
          Conta e segurança
        </Item>
        {userId && (
          <Item icone={Send} onClick={onTelegram} desc="Lançar por áudio ou foto no Telegram">
            Robô do Telegram
          </Item>
        )}
        {bioDisponivel && (
          <Item icone={ScanFace} onClick={alternarBiometria} valor={bioAtivo ? "Ativo" : "Desligado"}>
            Face ID / digital
          </Item>
        )}
        <Item icone={escuro ? Sun : Moon} onClick={alternarTema} valor={escuro ? "Escuro" : "Claro"}>
          Tema
        </Item>
        <Item icone={Lightbulb} onClick={onVerTour}>Dicas do app</Item>
      </Grupo>

      <Grupo titulo="Backup">
        <Item icone={Download} onClick={onExportar} desc="Baixa um arquivo com todos os seus dados">
          Exportar dados
        </Item>
        <Item icone={Upload} onClick={onImportar} desc="Restaura a partir de um arquivo de backup">
          Importar dados
        </Item>
      </Grupo>

      <button
        type="button"
        onClick={onSair}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-base font-semibold text-red-600 transition hover:bg-red-50 active:bg-red-100 dark:border-slate-800 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        <LogOut size={18} /> Sair da conta
      </button>
    </div>
  );
}

function Titulo({ children }) {
  return <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</h2>;
}

function Grupo({ titulo, children }) {
  return (
    <div>
      <Titulo>{titulo}</Titulo>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}

function Item({ icone: Icone, onClick, desc, valor, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icone size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-slate-800 dark:text-slate-100">{children}</span>
        {desc && <span className="block text-xs text-slate-500 dark:text-slate-400">{desc}</span>}
      </span>
      {valor && <span className="text-sm text-slate-500 dark:text-slate-400">{valor}</span>}
      <ChevronRight size={18} className="shrink-0 text-slate-400" />
    </button>
  );
}
