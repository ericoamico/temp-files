import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tempFiles = sqliteTable('temp_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shareId: text('share_id').notNull().unique(),
  objectKey: text('object_key').notNull().unique(),
  originalFileName: text('original_file_name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  status: text('status', { enum: ['pending', 'completed'] })
    .notNull()
    .default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  // Retenção solicitada pelo cliente (minutos). Aplicada na conclusão:
  // expiresAt definitivo = completedAt + retentionMinutes.
  retentionMinutes: integer('retention_minutes').notNull(),
});

export type TempFileInsert = typeof tempFiles.$inferInsert;
export type TempFileSelect = typeof tempFiles.$inferSelect;
