const { randomBytes } = require('node:crypto');
const Database = require('better-sqlite3');

const db = new Database('data/temp-files.db');
const mode = process.argv[2];

if (mode === 'insert-expired') {
  // Registro de teste especifico (concluido com expiracao no passado)
  const shareId = randomBytes(16).toString('base64url');
  const now = Date.now();
  db.prepare(
    `INSERT INTO temp_files
      (share_id, object_key, original_file_name, content_type, size, status,
       created_at, completed_at, expires_at, retention_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    shareId,
    'uploads/1970/01/01/expired-test-object',
    'expired-test.txt',
    'text/plain',
    123,
    'completed',
    now - 120000,
    now - 60000,
    now - 60000,
    60
  );
  console.log(shareId);
} else if (mode === 'delete') {
  db.prepare('DELETE FROM temp_files WHERE object_key = ?').run(process.argv[3]);
  console.log('registro de teste removido');
}

db.close();
