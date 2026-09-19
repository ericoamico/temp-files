import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { uploadRoutes } from './uploads.js';
import { fileRoutes } from './files.js';

export async function registerRoutes(app: FastifyInstance) {
  // Rotas atendidas em / e em /api: em producao o client Vue envia
  // /api/... na mesma origem (sem proxy); em dev o proxy do Vite ja
  // reescreve /api para a raiz. Duplo registro mantem os dois cenarios.
  for (const prefix of ['/', '/api']) {
    await app.register(healthRoutes, { prefix });
    await app.register(uploadRoutes, { prefix });
    await app.register(fileRoutes, { prefix });
  }
}
