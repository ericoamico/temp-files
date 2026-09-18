<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ApiError, getFileMeta, type FileMetaResponse } from '../api';
import { formatBytes, formatDateTime } from '../helpers';

const route = useRoute();

type PageState = 'loading' | 'valid' | 'notfound' | 'expired' | 'network';

const state = ref<PageState>('loading');
const meta = ref<FileMetaResponse | null>(null);
// Increments a cada retry para re-renderizar a msg de erro (role=alert)
// quando a mensagem se repete em acoes sucessivas.
const retryCount = ref(0);

const sizeText = computed(() => (meta.value ? formatBytes(meta.value.size) : ''));
const expiresText = computed(() =>
  meta.value ? formatDateTime(meta.value.expiresAt) : '',
);
const contentType = computed(() => meta.value?.contentType ?? '');
const hasUsefulContentType = computed(
  () => contentType.value !== '' && !contentType.value.startsWith('application/octet-stream'),
);

// Buffer de seguranca (10s): evita tentar baixar com a presigned URL
// prestes a expirar. Estrategia: re-solicitar GET /files/:shareId
// antes de iniciar o download quando necessario; o frontend nunca
// cria ou modifica presigned URLs.
const URL_FRESHNESS_BUFFER_MS = 10_000;

async function load() {
  state.value = 'loading';
  try {
    meta.value = await getFileMeta(String(route.params.shareId));
    state.value = 'valid';
  } catch (err) {
    meta.value = null;
    if (err instanceof ApiError && err.status === 404) {
      state.value = 'notfound';
    } else if (err instanceof ApiError && err.status === 410) {
      state.value = 'expired';
    } else {
      retryCount.value++;
      state.value = 'network';
    }
  }
}

function isDownloadUrlFresh(): boolean {
  if (!meta.value) return false;
  const expires = new Date(meta.value.downloadUrlExpiresAt).getTime();
  return (
    Number.isFinite(expires) &&
    expires - URL_FRESHNESS_BUFFER_MS > Date.now()
  );
}

async function freshDownloadUrl(): Promise<string | null> {
  if (meta.value && isDownloadUrlFresh()) return meta.value.downloadUrl;
  // Presigned URL expirada: solicita novamente antes de baixar.
  try {
    meta.value = await getFileMeta(String(route.params.shareId));
    return meta.value.downloadUrl;
  } catch {
    retryCount.value++;
    state.value = 'network';
    return null;
  }
}

async function onDownload() {
  const url = await freshDownloadUrl();
  if (!url) return;
  // Bytes baixados DIRETO do Cloudflare R2 (Content-Disposition
  // attachment vem assinado no GET presigned). Nao passa pelo Fastify.
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

onMounted(load);
</script>

<template>
  <main class="page">
    <h1>Arquivo compartilhado</h1>

    <!-- LOADING: anunciado por leitores de tela -->
    <p v-if="state === 'loading'" role="status" class="message">
      Carregando informações do arquivo…
    </p>

    <!-- 404 -->
    <section v-else-if="state === 'notfound'" aria-labelledby="nf-heading">
      <h2 id="nf-heading">Arquivo não encontrado</h2>
      <p role="alert" class="message message-alert">
        O link pode estar incorreto ou o arquivo pode não estar mais
        disponível.
      </p>
    </section>

    <!-- 410 -->
    <section v-else-if="state === 'expired'" aria-labelledby="exp-heading">
      <h2 id="exp-heading">Este arquivo expirou</h2>
      <p role="alert" class="message message-alert">
        Este arquivo temporário não está mais disponível para download.
      </p>
    </section>

    <!-- Falha de rede -->
    <section v-else-if="state === 'network'" aria-labelledby="net-heading">
      <h2 id="net-heading">Falha ao carregar</h2>
      <p role="alert" class="message message-alert">
        Não foi possível conectar ao servidor. Verifique sua conexão e tente
        novamente.
      </p>
      <button type="button" @click="load">Tentar novamente</button>
    </section>

    <!-- VALIDO -->
    <template v-else-if="state === 'valid' && meta">
      <p class="lead">
        Alguém compartilhou um arquivo temporário com você. Faça o download
        enquanto ele estiver disponível.
      </p>
      <dl class="file-info">
        <div>
          <dt>Nome</dt>
          <dd>{{ meta.originalFileName }}</dd>
        </div>
        <div>
          <dt>Tamanho</dt>
          <dd>{{ sizeText }}</dd>
        </div>
        <div v-if="hasUsefulContentType">
          <dt>Tipo</dt>
          <dd>{{ contentType }}</dd>
        </div>
        <div>
          <dt>Disponível até</dt>
          <dd>{{ expiresText }}</dd>
        </div>
      </dl>
      <p class="note">
        Este arquivo é temporário e será removido automaticamente após a
        expiração.
      </p>
      <button type="button" class="primary" @click="onDownload">
        Baixar arquivo
      </button>
    </template>
  </main>
</template>
