/**
 * Client tipado com o contrato REAL da API (src/routes/uploads.ts).
 * Chamadas relativas a /api: o proxy do Vite encaminha ao Fastify no
 * desenvolvimento; em producao, deploy no mesmo dominio.
 */

export interface StartUploadRequest {
  fileName: string;
  size: number;
  contentType: string;
  expiresInMinutes: number;
}

/** Resposta 201 de POST /uploads. */
export interface StartUploadResponse {
  status: 'pending';
  shareId: string;
  objectKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

/** Resposta 200 de POST /uploads/complete. */
export interface CompleteUploadResponse {
  status: 'completed';
  shareId: string;
  originalFileName: string;
  contentType: string;
  size: number;
  completedAt: string;
  expiresAt: string;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function requestJson<T>(
  path: string,
  body: unknown,
  expectedStatus: number,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Falha de rede ou de protocolo.
    throw new ApiError(0, 'Não foi possível conectar ao servidor.');
  }

  if (response.status !== expectedStatus) {
    throw new ApiError(
      response.status,
      'O servidor recusou a solicitação. Tente novamente.',
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, 'Resposta inválida do servidor.');
  }
}

export function startUpload(
  request: StartUploadRequest,
): Promise<StartUploadResponse> {
  return requestJson<StartUploadResponse>(
    '/api/uploads',
    request,
    201,
  );
}

export function completeUpload(
  objectKey: string,
): Promise<CompleteUploadResponse> {
  return requestJson<CompleteUploadResponse>(
    '/api/uploads/complete',
    { objectKey },
    200,
  );
}
