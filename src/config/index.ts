import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  db: {
    fileName: process.env.DB_FILE_NAME || 'data/temp-files.db',
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },
  uploads: {
    // TTL da presigned URL de PUT: controlado pelo servidor,
    // nunca pelo cliente.
    putUrlTtlMinutes: Number(process.env.PUT_URL_TTL_MINUTES) || 10,
    // TTL da presigned URL de GET (download): também do servidor,
    // independente do expiresAt do arquivo.
    downloadUrlTtlMinutes: Number(process.env.DOWNLOAD_URL_TTL_MINUTES) || 5,
    // Retenção do arquivo após a conclusão do upload (minutos):
    // é isto que o expiresInMinutes do cliente representa.
    minFileRetentionMinutes: 5,
    maxFileRetentionMinutes: 10080, // 7 dias
    maxFileSizeBytes: 100 * 1024 * 1024, // 100 MB
  },
} as const;
