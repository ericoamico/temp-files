import { config } from '../config/index.js';
import { deleteObject } from '../services/r2.js';
import {
  deleteFileById,
  findAbandonedPending,
  findCompletedExpired,
} from '../services/files.js';
import type { TempFileSelect } from '../db/schema.js';

let isRunning = false;

export interface CleanupStats {
  removedCompleted: number;
  removedPending: number;
  failures: number;
}

/**
 * Tenta remover o objeto do R2 e, só depois da remoção bem-sucedida,
 * o registro do SQLite. Falha não lança: é contabilizada para retry
 * na próxima execução. O erro é logado apenas com o shareId (público),
 * nunca com credenciais ou URLs assinadas.
 */
async function removeExpiredRecord(
  record: TempFileSelect,
): Promise<'removed' | 'failed'> {
  try {
    await deleteObject(record.objectKey);
    deleteFileById(record.id);
    return 'removed';
  } catch {
    console.error(
      `[cleanup] falha ao remover objeto do storage (shareId: ${record.shareId}); registro mantido para retry`,
    );
    return 'failed';
  }
}

async function drainExpired(
  fetchRecords: (limit: number) => TempFileSelect[],
  onRemoved: () => void,
): Promise<number> {
  let failures = 0;
  while (true) {
    const records = fetchRecords(config.cleanup.batchSize);
    if (records.length === 0) break;

    let removed = 0;
    for (const record of records) {
      const result = await removeExpiredRecord(record);
      if (result === 'removed') {
        removed++;
        onRemoved();
      } else {
        failures++;
      }
    }

    // Nada progrediu nesta passada: falhas persistentes seriam
    // reprocessadas infinitamente; deixa para a próxima execução.
    if (removed === 0) break;
  }
  return failures;
}

export async function runExpiredFilesCleanup(): Promise<CleanupStats> {
  if (isRunning) {
    console.log('[cleanup] execucao em andamento; pulando intervalo');
    return { removedCompleted: -1, removedPending: -1, failures: -1 };
  }

  isRunning = true;
  try {
    const now = new Date();
    // Política para pendings abandonados: TTL da presigned PUT + margem.
    const pendingCutoff = new Date(
      now.getTime() -
        (config.uploads.putUrlTtlMinutes +
          config.cleanup.pendingCutoffMarginMinutes) *
          60_000,
    );

    const stats: CleanupStats = {
      removedCompleted: 0,
      removedPending: 0,
      failures: 0,
    };

    stats.failures += await drainExpired(
      (limit) => findCompletedExpired(limit, now),
      () => {
        stats.removedCompleted++;
      },
    );

    stats.failures += await drainExpired(
      (limit) => findAbandonedPending(limit, pendingCutoff),
      () => {
        stats.removedPending++;
      },
    );

    console.log(
      `[cleanup] concluido: ${stats.removedCompleted} expirados removidos, ` +
        `${stats.removedPending} pendentes abandonados removidos, ` +
        `${stats.failures} falhas (retry na proxima execucao)`,
    );
    return stats;
  } finally {
    isRunning = false;
  }
}

/**
 * Executa a limpeza uma vez na inicialização e depois periodicamente
 * enquanto a aplicação estiver rodando. Execuções concorrentes dentro
 * da mesma instância são evitadas pelo guard isRunning.
 */
export function startCleanupScheduler(): void {
  void runExpiredFilesCleanup();

  const intervalMs = config.cleanup.intervalMinutes * 60_000;
  setInterval(() => {
    void runExpiredFilesCleanup();
  }, intervalMs);
}
