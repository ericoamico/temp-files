import { ApiError, completeUpload, type CompleteUploadResponse } from './api';

/**
 * Faz o PUT do arquivo DIRETAMENTE para a presigned uploadUrl do
 * Cloudflare R2 usando XMLHttpRequest — necessário para eventos
 * reais de progresso (fetch não expõe progresso de upload).
 * Bytes NAO passam pelo Fastify nem pelo proxy do Vite.
 */
export function putFileToR2(
  uploadUrl: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    for (const [name, value] of Object.entries(headers)) {
      try {
        xhr.setRequestHeader(name, value);
      } catch {
        // Header não aceito pelo navegador (ex.: Host); ignora.
      }
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError(0, 'A conexão foi interrompida durante o envio.'));
    };

    xhr.ontimeout = () => {
      reject(new ApiError(0, 'O envio demorou demais e foi interrompido.'));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new ApiError(xhr.status, 'O servidor de arquivos recusou o envio.'));
      }
    };

    xhr.send(file);
  });
}

export async function uploadFlow(options: {
  file: File;
  startUpload: () => Promise<{
    uploadUrl: string;
    headers: Record<string, string>;
    objectKey: string;
  }>;
  onProgress: (percent: number) => void;
}): Promise<CompleteUploadResponse> {
  const presigned = await options.startUpload();
  // Se o PUT falhar, /uploads/complete NAO é chamado.
  await putFileToR2(
    presigned.uploadUrl,
    presigned.headers,
    options.file,
    options.onProgress,
  );
  return completeUpload(presigned.objectKey);
}
