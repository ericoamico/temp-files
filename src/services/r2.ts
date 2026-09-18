import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';

export class StorageUnavailableError extends Error {
  statusCode = 503;
  constructor(message = 'Storage (R2) não configurado no servidor') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export class StorageRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageRequestError';
  }
}

export interface PresignedUpload {
  objectKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  urlTtlMinutes: number;
}

export interface StoredObject {
  exists: boolean;
  size?: number;
  contentType?: string;
  lastModified?: Date;
}

let cachedClient: S3Client | null = null;

export function isStorageConfigured(): boolean {
  const { r2 } = config;
  return Boolean(
    r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket,
  );
}

function getClient(): S3Client {
  if (!isStorageConfigured()) {
    throw new StorageUnavailableError();
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
      // Evita que o SDK embuta checksums (com valores dummy) nas
      // presigned URLs, o que quebraria o PUT do cliente.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return cachedClient;
}

/**
 * Gera uma object key aleatória e segura.
 * O nome original nunca é usado como key; apenas a extensão é
 * derivada dele, após sanitização estrita.
 */
export function buildSafeObjectKey(fileName: string): string {
  const ext = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
    : '';
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : '';
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `uploads/${yyyy}/${mm}/${dd}/${randomUUID()}${safeExt}`;
}

/**
 * Gera a presigned URL de PUT. O TTL é do servidor
 * (config.uploads.putUrlTtlMinutes) e não controlável pelo cliente.
 */
export async function createPresignedPut(params: {
  fileName: string;
  size: number;
  contentType: string;
}): Promise<PresignedUpload> {
  const ttl = config.uploads.putUrlTtlMinutes;
  const objectKey = buildSafeObjectKey(params.fileName);
  const client = getClient();

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: objectKey,
      ContentType: params.contentType,
      ContentLength: params.size,
    }),
    {
      expiresIn: ttl * 60,
      // Garante que o Content-Type assinado seja exigido no PUT,
      // impedindo upload de conteúdo com tipo não autorizado.
      signableHeaders: new Set(['content-type']),
    },
  );

  return {
    objectKey,
    uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': params.contentType },
    urlTtlMinutes: ttl,
  };
}

/**
 * Constrói o header Content-Disposition de attachment preservando
 * o nome original (RFC 6266/5987): fallback ASCII filtrado +
 * filename*=UTF-8'' percent-encoded. Ambos os trechos são
 * construídos por filtro/encoding, o que impede injeção de
 * headers (CR/LF e aspas não sobrevivem).
 */
function buildAttachmentDisposition(fileName: string): string {
  const asciiFallback = fileName
    .normalize('NFKD')
    .replace(/[\u0080-\uFFFF]/g, '')
    .replace(/[\u0000-\u001F\u007F"\\]/g, '');
  return (
    `attachment; filename="${asciiFallback}"; ` +
    `filename*=UTF-8''${encodeURIComponent(fileName)}`
  );
}

export interface PresignedDownload {
  downloadUrl: string;
  urlTtlMinutes: number;
}

/**
 * Gera a presigned URL de GET (download). O TTL é do servidor
 * (config.uploads.downloadUrlTtlMinutes), independente do
 * expiresAt do arquivo. Os bytes nunca passam pelo servidor Fastify.
 */
export async function createPresignedGet(params: {
  objectKey: string;
  fileName: string;
  contentType: string;
}): Promise<PresignedDownload> {
  const ttl = config.uploads.downloadUrlTtlMinutes;
  const client = getClient();

  const downloadUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.r2.bucket,
      Key: params.objectKey,
      ResponseContentType: params.contentType,
      ResponseContentDisposition: buildAttachmentDisposition(params.fileName),
    }),
    { expiresIn: ttl * 60 },
  );

  return { downloadUrl, urlTtlMinutes: ttl };
}

export async function getStoredObject(
  objectKey: string,
): Promise<StoredObject> {
  const client = getClient();
  try {
    const res: HeadObjectCommandOutput = await client.send(
      new HeadObjectCommand({ Bucket: config.r2.bucket, Key: objectKey }),
    );
    return {
      exists: true,
      size: res.ContentLength,
      contentType: res.ContentType,
      lastModified: res.LastModified,
    };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'NotFound' || name === 'NoSuchKey' || name === '404') {
      return { exists: false };
    }
    throw new StorageRequestError(
      `Falha ao consultar o storage: ${name ?? 'erro desconhecido'}`,
    );
  }
}
