import { buildApp } from './app.js';
import { config } from './config/index.js';
import { startCleanupScheduler } from './workers/cleanup.js';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  startCleanupScheduler();
}

void main();
