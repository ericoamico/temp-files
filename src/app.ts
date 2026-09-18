import exists from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config/index.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  await registerRoutes(app);

  // Producao: o Fastify serve o build do frontend no MESMO dominio.
  // Elimina CORS entre frontend e backend e habilita fallback de SPA
  // para /f/:shareId. Em producao a imagem sempre inclui frontend/dist;
  // o guard cobre o caso dev sem build.
  const frontendDist = path.resolve('frontend/dist');
  if (exists.existsSync(path.join(frontendDist, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
      setHeaders: (reply, filePath) => {
        if (filePath.replace(/\\/g, '/').includes('/assets/')) {
          reply.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    });

    // Fallback de SPA: qualquer GET/HEAD nao-API recebe o index.html.
    // Rotas nao encontradas sob /api mantem o 404 JSON da API.
    app.setNotFoundHandler((request, reply) => {
      const isApi = request.raw.url?.startsWith('/api') ?? false;
      const isRead = request.method === 'GET' || request.method === 'HEAD';
      if (!isApi && isRead) {
        reply.sendFile('index.html');
        return;
      }
      reply.code(404).send({
        message: 'Rota nao encontrada.',
        error: 'Not Found',
        statusCode: 404,
      });
    });
  }

  // Producao: erros inesperados nunca vazam stack/SDK para o cliente.
  app.setErrorHandler((error: { statusCode?: number } & Error, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error(error);
      reply.code(500).send({ message: 'Erro interno do servidor.' });
      return;
    }
    reply.code(status).send({ message: error.message });
  });

  return app;
}
