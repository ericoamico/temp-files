import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config/index.js';
import * as schema from './schema.js';

mkdirSync(dirname(config.db.fileName), { recursive: true });

export const sqlite = new Database(config.db.fileName);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { schema };
