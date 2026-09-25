import React, { useEffect, useState } from "react";
import { Camera, Sun, Moon, ScanFace, Send, Download, Upload, Lightbulb, Database, LogOut, ChevronRight, Cloud, Lock } from "lucide-react";
import { statusTelegram } from "../telegramLink";

/* ============================================================
   PERFIL E CONFIGURAÇÕES — quem está usando e como o app se comporta.
   Abre pela foto no topo da tela. As ferramentas de finanças ficam em
   "Mais"; aqui ficam aparência, segurança, integrações e backup.
   ============================================================ */

export function PaginaPerfil({
  login, email, userId, escuro, definirTema, bioDisponivel, bioAtivo, alternarBiometria,
  onTelegram, onExportar, onImportar, onTrocarFoto, onSair, onVerTour, irPara,
}) {
  const nome = login?.nome || "Minha conta";
  const [tg, setTg] = useState(undefined); // undefined = verificando | null = não | obj = sim

  useEffect(() => {
    let vivo = true;
    if (userId) statusTelegram(userId).then((v) => vivo && setTg(v)).catch(() => vivo && setTg(null));
    else setTg(null);
    return () => {
      vivo = false;
    };
  }, [userId]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Cabeçalho do perfil */}
      <div className="flex flex-col items-center pt-2 text-center">
        <button type="button" onClick={onTrocarFoto} className="relative" aria-label="Trocar foto do perfil">
          {login?.foto ? (
            <img src={login.foto} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-white dark:ring-slate-900" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-4xl font-bold text-emerald-700 ring-4 ring-white dark:bg-emerald-950 dark:text-emerald-300 dark:ring-slate-900">
              {nome.trim()[0]?.toUpperCase() || "?"}
            </span>
          )}
          <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-4 border-slate-50 bg-emerald-600 text-white dark:border-slate-950">
            <Camera size={15} />
          </span>
        </button>
        <p className="mt-3 text-xl font-bold text-slate-800 dark:text-slate-100">{nome}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          {email ? <Cloud size={14} /> : <Lock size={14} />}
          {email || "Dados só neste aparelho"}
        </p>
      </div>

      {/* Aparência */}
      <Grupo titulo="Aparência">
        <div className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
          <Icone>{escuro ? <Moon size={18} /> : <Sun size={18} />}</Icone>
          <span className="flex-1 text-base font-medium text-slate-800 dark:text-slate-100">Tema</span>
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Tema">
            {[
              [false, "Claro", Sun],
              [true, "Escuro", Moon],
            ].map(([v, r, I]) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={escuro === v}
                onClick={() => definirTema(v)}
                className={
                  "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition " +
                  (escuro === v ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")
                }
              >
                <I size={14} /> {r}
              </button>
            ))}
          </div>
        </div>
      </Grupo>

      {/* Segurança */}
      <Grupo titulo="Segurança e dados">
        {bioDisponivel && (
          <button type="button" onClick={alternarBiometria} className={linha} role="switch" aria-checked={bioAtivo}>
            <Icone>
              <ScanFace size={18} />
            </Icone>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-slate-800 dark:text-slate-100">Face ID / digital</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Abrir o app com o rosto ou o dedo</span>
            </span>
            <Interruptor ligado={bioAtivo} />
          </button>
        )}
        <Item icone={Database} onClick={() => irPara("conta")} desc="Onde ficam os dados, notificações, limpar dados">
          Dados e notificações
        </Item>
      </Grupo>

      {/* Integrações */}
      {userId && (
        <Grupo titulo="Integrações">
          <Item
            icone={Send}
            onClick={onTelegram}
            desc="Lançar por áudio, foto ou mensagem"
            valor={tg === undefined ? "…" : tg ? "Conectado" : "Conectar"}
            valorCor={tg ? "text-emerald-600 dark:text-emerald-400" : undefined}
          >
            Robô do Telegram
          </Item>
        </Grupo>
      )}

      {/* Backup */}
      <Grupo titulo="Backup">
        <Item icone={Download} onClick={onExportar} desc="Baixa um arquivo com todos os seus dados">
          Exportar dados
        </Item>
        <Item icone={Upload} onClick={onImportar} desc="Restaura a partir de um arquivo de backup">
          Importar dados
        </Item>
      </Grupo>

      <Grupo titulo="Ajuda">
        <Item icone={Lightbulb} onClick={onVerTour} desc="Instalar no celular, Face ID e Telegram">
          Dicas do app
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

const linha = "flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60";

function Grupo({ titulo, children }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h2>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>
    </section>
  );
}

function Icone({ children }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </span>
  );
}

function Interruptor({ ligado }) {
  return (
    <span aria-hidden className={"relative h-7 w-12 shrink-0 rounded-full transition " + (ligado ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}>
      <span className={"absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all " + (ligado ? "left-[22px]" : "left-0.5")} />
    </span>
  );
}

function Item({ icone: I, onClick, desc, valor, valorCor, children }) {
  return (
    <button type="button" onClick={onClick} className={linha}>
      <Icone>
        <I size={18} />
      </Icone>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-slate-800 dark:text-slate-100">{children}</span>
        {desc && <span className="block text-xs text-slate-500 dark:text-slate-400">{desc}</span>}
      </span>
      {valor && <span className={"text-sm font-medium " + (valorCor || "text-slate-500 dark:text-slate-400")}>{valor}</span>}
      <ChevronRight size={18} className="shrink-0 text-slate-400" />
    </button>
  );
}
