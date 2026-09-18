import { and, eq, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tempFiles, type TempFileSelect } from '../db/schema.js';

export function createPendingFile(values: {
  shareId: string;
  objectKey: string;
  originalFileName: string;
  contentType: string;
  size: number;
  retentionMinutes: number;
  createdAt: Date;
  expiresAt: Date;
}): TempFileSelect {
  return db
    .insert(tempFiles)
    .values({ ...values, status: 'pending', completedAt: null })
    .returning()
    .get();
}

export function findFileByObjectKey(
  objectKey: string,
): TempFileSelect | undefined {
  return db
    .select()
    .from(tempFiles)
    .where(eq(tempFiles.objectKey, objectKey))
    .get();
}

export function findFileByShareId(
  shareId: string,
): TempFileSelect | undefined {
  return db
    .select()
    .from(tempFiles)
    .where(eq(tempFiles.shareId, shareId))
    .get();
}

export function completeFile(
  id: number,
  values: { completedAt: Date; expiresAt: Date },
): TempFileSelect {
  return db
    .update(tempFiles)
    .set({ status: 'completed', ...values })
    .where(eq(tempFiles.id, id))
    .returning()
    .get();
}

export function findCompletedExpired(
  limit: number,
  before: Date,
): TempFileSelect[] {
  return db
    .select()
    .from(tempFiles)
    .where(
      and(eq(tempFiles.status, 'completed'), lte(tempFiles.expiresAt, before)),
    )
    .limit(limit)
    .all();
}

export function findAbandonedPending(
  limit: number,
  before: Date,
): TempFileSelect[] {
  return db
    .select()
    .from(tempFiles)
    .where(
      and(eq(tempFiles.status, 'pending'), lte(tempFiles.createdAt, before)),
    )
    .limit(limit)
    .all();
}

export function deleteFileById(id: number): void {
  db.delete(tempFiles).where(eq(tempFiles.id, id)).run();
}
