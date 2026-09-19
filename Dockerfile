# ---- Stage 1: builder (build backend + frontend) ----
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
COPY frontend/package.json frontend/yarn.lock ./frontend/
COPY frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json frontend/index.html frontend/vite.config.ts ./frontend/
COPY frontend/src ./frontend/src

RUN yarn build && cd frontend && yarn install --frozen-lockfile && yarn build

# ---- Stage 2: deps de producao ----
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# ---- Stage 3: imagem final ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DB_FILE_NAME=/data/temp-files.db

COPY --from=prod-deps /app/package.json /app/yarn.lock ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/frontend/dist ./frontend/dist

# /data e montado como volume persistente (Fly.io); o bootstrap cria
# o diretorio se faltar. Migrations sao aplicadas no arranque de forma
# idempotente, sem destruir registros existentes.
EXPOSE 8080
CMD ["sh", "-c", "./node_modules/.bin/drizzle-kit migrate && node dist/server.js"]
