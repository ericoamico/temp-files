import 'dotenv/config';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// O backend Fastify roda na porta 3000 (raiz do repo). O proxy elimina
// CORS entre Vite (5173) e Fastify no desenvolvimento: o navegador vê
// tudo como same-origin. Bytes do arquivo NAO passam pelo proxy — o PUT
// vai direto do navegador para o Cloudflare R2 (presigned URL).
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
