import type { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';
import { generateShareId } from '../utils/ids.js';
import { createPresignedPut, getStoredObject } from '../services/r2.js';
import {
  completeFile,
  createPendingFile,
  findFileByObjectKey,
} from '../services/files.js';

const fileNameSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 255,
} as const;

const contentTypeSchema = {
  type: 'string',
  pattern: '^[a-zA-Z]+/[a-zA-Z0-9][a-zA-Z0-9.+-]*$',
  maxLength: 100,
} as const;

function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

export async function uploadRoutes(app: FastifyInstance) {
  app.post(
    '/uploads',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            fileName: fileNameSchema,
            size: {
              type: 'integer',
              minimum: 1,
              maximum: config.uploads.maxFileSizeBytes,
            },
            contentType: contentTypeSchema,
            // Retenção do ARQUIVO depois da conclusão do upload (minutos).
            expiresInMinutes: {
              type: 'integer',
              minimum: 1,
              // Rejeita valores absurdos antes do clamp; os limites
              // definitivos ficam em config.uploads.min/maxFileRetentionMinutes.
              maximum: 43200,
            },
          },
          required: ['fileName', 'size', 'contentType', 'expiresInMinutes'],
          additionalProperties: false,
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { const: 'pending' },
              shareId: { type: 'string' },
              objectKey: { type: 'string' },
              uploadUrl: { type: 'string' },
              method: { const: 'PUT' },
              headers: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
              // Provisório: definitivo é recalculado na conclusão
              // (completedAt + expiresInMinutes).
              expiresAt: { type: 'string' },
            },
            required: [
              'status',
              'shareId',
              'objectKey',
              'uploadUrl',
              'method',
              'headers',
              'expiresAt',
            ],
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        fileName: string;
        size: number;
        contentType: string;
        expiresInMinutes: number;
      };

      const retentionMinutes = Math.min(
        Math.max(
          body.expiresInMinutes,
          config.uploads.minFileRetentionMinutes,
        ),
        config.uploads.maxFileRetentionMinutes,
      );

      const now = new Date();
      const expiresAt = new Date(now.getTime() + retentionMinutes * 60_000);

      const presigned = await createPresignedPut({
        fileName: body.fileName,
        size: body.size,
        contentType: body.contentType,
      });

      const record = createPendingFile({
        shareId: generateShareId(),
        objectKey: presigned.objectKey,
        originalFileName: body.fileName,
        contentType: body.contentType,
        size: body.size,
        retentionMinutes,
        createdAt: now,
        expiresAt,
      });

      return reply.code(201).send({
        status: 'pending' as const,
        shareId: record.shareId,
        objectKey: presigned.objectKey,
        uploadUrl: presigned.uploadUrl,
        method: 'PUT',
        headers: presigned.headers,
        expiresAt: record.expiresAt.toISOString(),
      });
    },
  );

  app.post(
    '/uploads/complete',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            objectKey: {
              type: 'string',
              pattern:
                '^uploads/\\d{4}/\\d{2}/\\d{2}/[0-9a-f-]{36}(\\.[a-z0-9]{1,8})?$',
              maxLength: 128,
            },
          },
          required: ['objectKey'],
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { const: 'completed' },
              shareId: { type: 'string' },
              objectKey: { type: 'string' },
              originalFileName: { type: 'string' },
              contentType: { type: 'string' },
              size: { type: 'number' },
              completedAt: { type: 'string' },
              expiresAt: { type: 'string' },
            },
            required: [
              'status',
              'shareId',
              'objectKey',
              'originalFileName',
              'contentType',
              'size',
              'completedAt',
              'expiresAt',
            ],
          },
        },
      },
    },
    async (request) => {
      const { objectKey } = request.body as { objectKey: string };

      const record = findFileByObjectKey(objectKey);
      if (!record) {
        throw httpError(
          404,
          'Registro não encontrado para a objectKey informada.',
        );
      }

      if (record.status === 'completed') {
        return {
          status: 'completed' as const,
          shareId: record.shareId,
          objectKey: record.objectKey,
          originalFileName: record.originalFileName,
          contentType: record.contentType,
          size: record.size,
          completedAt: record.completedAt?.toISOString() ?? '',
          expiresAt: record.expiresAt.toISOString(),
        };
      }

      const stored = await getStoredObject(objectKey);

      if (!stored.exists) {
        throw httpError(
          404,
          'Objeto não encontrado no storage. O PUT foi concluído?',
        );
      }

      if (stored.size !== record.size) {
        throw httpError(
          409,
          `Tamanho no storage (${stored.size}) difere do informado (${record.size}).`,
        );
      }

      const completedAt = new Date();
      const expiresAt = new Date(
        completedAt.getTime() + record.retentionMinutes * 60_000,
      );

      const updated = completeFile(record.id, { completedAt, expiresAt });

      return {
        status: 'completed' as const,
        shareId: updated.shareId,
        objectKey: updated.objectKey,
        originalFileName: updated.originalFileName,
        contentType: updated.contentType,
        size: updated.size,
        completedAt: updated.completedAt?.toISOString() ?? '',
        expiresAt: updated.expiresAt.toISOString(),
      };
    },
  );
}
