import 'dotenv/config';
import { runExpiredFilesCleanup } from './src/workers/cleanup.js';

void (async () => {
  console.log('[check] iniciando duas execucoes simultaneas na mesma instancia');
  const [a, b] = await Promise.all([
    runExpiredFilesCleanup(),
    runExpiredFilesCleanup(),
  ]);
  console.log('[check] resultado execucao 1:', a);
  console.log('[check] resultado execucao 2:', b);
  const skipped = a.failures < 0 || b.failures < 0;
  console.log('[check] execucao ignorada por guard de concorrencia:', skipped);
  process.exit(0);
})();
