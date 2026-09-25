import { normalizarDados } from "./dados";

/* ============================================================
   BACKUP — formato do "Exportar dados" / "Importar dados"
   O arquivo é o próprio estado do app: { versao: 2, pessoal, empresarial }.
   O backup automático da nuvem (supabase/functions/backup) grava o MESMO
   formato. Mudar isto quebra a restauração dos backups já guardados — os
   testes em backup.test.js travam o formato.
   ============================================================ */

export const serializarBackup = (data) => JSON.stringify(data, null, 2);

// Lê o texto de um arquivo de backup. Lança erro se não for JSON; devolve
// null se a estrutura não for reconhecida (v2 ou planilhas v1).
export function lerBackup(texto) {
  return normalizarDados(JSON.parse(texto));
}

export const nomeArquivoBackup = (hoje = new Date()) => `thayfinance-${hoje.toISOString().slice(0, 10)}.json`;
