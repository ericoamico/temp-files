<script setup lang="ts">
import { computed, ref } from 'vue';
import { ApiError, startUpload, type CompleteUploadResponse } from './api';
import { uploadFlow } from './upload';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_RETENTION_MINUTES,
  buildShareUrl,
  formatBytes,
  formatDateTime,
} from './helpers';

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const expiresInMinutes = ref(30);

type PageState = 'idle' | 'uploading' | 'done';

const pageState = ref<PageState>('idle');
const uploadPercent = ref(0);
const statusMessage = ref('');
const errorMessage = ref('');
const result = ref<CompleteUploadResponse | null>(null);
const shareUrl = ref('');
const copyResult = ref<'copied' | 'failed' | null>(null);

const fileTooLarge = computed(
  () => selectedFile.value !== null && selectedFile.value.size > MAX_FILE_SIZE_BYTES,
);

const durationOptions = [
  { minutes: 5, label: '5 minutos' },
  { minutes: 30, label: '30 minutos' },
  { minutes: 60, label: '1 hora' },
  { minutes: 360, label: '6 horas' },
  { minutes: 1440, label: '24 horas' },
  { minutes: MAX_RETENTION_MINUTES, label: '7 dias' },
];

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  errorMessage.value = '';
  result.value = null;
  copyResult.value = null;
  selectedFile.value = input.files && input.files.length > 0 ? input.files[0] : null;
}

function resetForm() {
  selectedFile.value = null;
  if (fileInput.value) fileInput.value.value = '';
  pageState.value = 'idle';
  uploadPercent.value = 0;
  statusMessage.value = '';
  errorMessage.value = '';
  result.value = null;
  shareUrl.value = '';
  copyResult.value = null;
}

async function onSend() {
  errorMessage.value = '';
  copyResult.value = null;
  if (!selectedFile.value || fileTooLarge.value) return;

  pageState.value = 'uploading';
  uploadPercent.value = 0;
  statusMessage.value = 'Solicitando autorização de envio…';

  try {
    result.value = await uploadFlow({
      file: selectedFile.value,
      onProgress: (percent) => {
        uploadPercent.value = percent;
        statusMessage.value =
          percent < 100 ? 'Enviando arquivo…' : 'Confirmando conclusão…';
      },
      startUpload: () =>
        startUpload({
          fileName: selectedFile.value!.name,
          size: selectedFile.value!.size,
          contentType: selectedFile.value!.type || 'application/octet-stream',
          expiresInMinutes: expiresInMinutes.value,
        }),
    });
    pageState.value = 'done';
    statusMessage.value = 'Upload concluído.';
    shareUrl.value = buildShareUrl(result.value.shareId);
  } catch (err) {
    statusMessage.value = '';
    if (err instanceof ApiError && err.status === 0) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value =
        'Não foi possível concluir o envio. Verifique sua conexão e tente novamente.';
    }
    pageState.value = 'idle';
  }
}

async function onCopy() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    copyResult.value = 'copied';
  } catch {
    copyResult.value = 'failed';
  }
}
</script>

<template>
  <main class="page">
    <h1>Compartilhar arquivo</h1>
    <p class="lead">
      Envie um arquivo e receba um link de download privado. O arquivo fica
      disponível apenas pelo tempo que você escolher.
    </p>

    <!-- ERROS: anunciado imediatamente por leitores de tela -->
    <p v-if="errorMessage" role="alert" class="message message-alert">
      {{ errorMessage }}
    </p>

    <!-- MENSAGENS DE STATUS: anunciado com cortesia -->
    <p v-if="statusMessage" role="status" class="message">
      {{ statusMessage }}
    </p>

    <section aria-labelledby="upload-heading">
      <h2 id="upload-heading" class="visually-hidden">
        Selecionar e enviar arquivo
      </h2>

      <!-- SELETOR DE ARQUIVO (tradicional, com label) -->
      <div class="field">
        <label for="file-input">Arquivo para enviar</label>
        <input
          id="file-input"
          ref="fileInput"
          type="file"
          :disabled="pageState === 'uploading'"
          aria-describedby="file-help"
          @change="onFileChange"
        />
        <p id="file-help" class="help">
          Tamanho máximo permitido: {{ formatBytes(MAX_FILE_SIZE_BYTES) }}.
        </p>
        <p v-if="selectedFile && selectedFile.size > MAX_FILE_SIZE_BYTES" class="help help-error">
          O arquivo selecionado excede o tamanho máximo permitido.
        </p>
      </div>

      <!-- INFO DO ARQUIVO -->
      <dl v-if="selectedFile" class="file-info">
        <div>
          <dt>Nome</dt>
          <dd>{{ selectedFile.name }}</dd>
        </div>
        <div>
          <dt>Tamanho</dt>
          <dd>{{ formatBytes(selectedFile.size) }}</dd>
        </div>
        <div v-if="selectedFile.type">
          <dt>Tipo</dt>
          <dd>{{ selectedFile.type }}</dd>
        </div>
      </dl>

      <!-- DURAÇÃO -->
      <div class="field">
        <label for="duration-select">Por quanto tempo o arquivo ficará disponível</label>
        <select
          id="duration-select"
          v-model.number="expiresInMinutes"
          :disabled="pageState === 'uploading'"
        >
          <option v-for="option in durationOptions" :key="option.minutes" :value="option.minutes">
            {{ option.label }}
          </option>
        </select>
      </div>

      <button
        type="button"
        class="primary"
        :disabled="!selectedFile || fileTooLarge || pageState === 'uploading'"
        @click="onSend"
      >
        Enviar arquivo
      </button>

      <!-- PROGRESSO: elemento <progress> + porcentagem textual -->
      <div v-if="pageState === 'uploading'" class="progress-block">
        <label for="upload-progress">Progresso do envio</label>
        <progress
          id="upload-progress"
          :value="uploadPercent"
          max="100"
        >{{ uploadPercent }}%</progress>
        <span aria-hidden="true">{{ uploadPercent }}%</span>
        <span class="visually-hidden">Arquivo {{ uploadPercent }}% enviado</span>
      </div>
    </section>

    <!-- RESULTADO: anunciado por role=status -->
    <section v-if="pageState === 'done' && result" aria-labelledby="done-heading">
      <h2 id="done-heading">Upload concluído</h2>
      <p role="status" class="message">
        Arquivo enviado com sucesso. O link de compartilhamento está pronto.
      </p>
      <dl class="file-info">
        <div>
          <dt>Arquivo</dt>
          <dd>{{ result.originalFileName }}</dd>
        </div>
        <div>
          <dt>Tamanho</dt>
          <dd>{{ formatBytes(result.size) }}</dd>
        </div>
        <div>
          <dt>Expira em</dt>
          <dd>{{ formatDateTime(result.expiresAt) }}</dd>
        </div>
      </dl>
      <div class="field">
        <label for="share-link">Link de compartilhamento</label>
        <input id="share-link" type="text" readonly :value="shareUrl" />
      </div>
      <div class="actions">
        <button type="button" class="primary" @click="onCopy">Copiar link</button>
        <button type="button" @click="resetForm">Enviar outro arquivo</button>
      </div>
      <!-- Resultado da cópia anunciado por leitores de tela -->
      <p v-if="copyResult === 'copied'" role="status" class="message">
        Link copiado para a área de transferência.
      </p>
      <p v-else-if="copyResult === 'failed'" role="alert" class="message message-alert">
        Não foi possível copiar automaticamente. Selecione o link e copie manualmente.
      </p>
    </section>
  </main>
</template>
