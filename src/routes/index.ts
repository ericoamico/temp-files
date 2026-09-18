import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { uploadRoutes } from './uploads.js';
import { fileRoutes } from './files.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes, { prefix: '/' });
  await app.register(uploadRoutes, { prefix: '/' });
  await app.register(fileRoutes, { prefix: '/' });
}
