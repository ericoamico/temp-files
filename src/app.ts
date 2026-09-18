import Fastify from 'fastify';
import { config } from './config/index.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  await registerRoutes(app);

  return app;
}
