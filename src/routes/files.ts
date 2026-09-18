import type { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';
import { findFileByShareId } from '../services/files.js';
import { createPresignedGet } from '../services/r2.js';

function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

export async function fileRoutes(app: FastifyInstance) {
  app.get(
    '/files/:shareId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            shareId: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
          },
          required: ['shareId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              shareId: { type: 'string' },
              originalFileName: { type: 'string' },
              contentType: { type: 'string' },
              size: { type: 'number' },
              expiresAt: { type: 'string' },
              downloadUrl: { type: 'string' },
              downloadUrlExpiresAt: { type: 'string' },
            },
            required: [
              'shareId',
              'originalFileName',
              'contentType',
              'size',
              'expiresAt',
              'downloadUrl',
              'downloadUrlExpiresAt',
            ],
          },
        },
      },
    },
    async (request) => {
      const { shareId } = request.params as { shareId: string };

      const record = findFileByShareId(shareId);
      if (!record || record.status !== 'completed') {
        throw httpError(404, 'Arquivo não encontrado.');
      }

      if (record.expiresAt.getTime() <= Date.now()) {
        throw httpError(410, 'Este arquivo já expirou.');
      }

      const presigned = await createPresignedGet({
        objectKey: record.objectKey,
        fileName: record.originalFileName,
        contentType: record.contentType,
      });

      const downloadUrlExpiresAt = new Date(
        Date.now() + config.uploads.downloadUrlTtlMinutes * 60_000,
      );

      return {
        shareId: record.shareId,
        originalFileName: record.originalFileName,
        contentType: record.contentType,
        size: record.size,
        expiresAt: record.expiresAt.toISOString(),
        downloadUrl: presigned.downloadUrl,
        downloadUrlExpiresAt: downloadUrlExpiresAt.toISOString(),
      };
    },
  );
}
