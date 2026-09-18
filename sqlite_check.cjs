const Database = require('better-sqlite3');

const objectKey = process.argv[2];
if (!objectKey) {
  console.error('uso: node sqlite_check.cjs <object_key>');
  process.exit(1);
}

const db = new Database('data/temp-files.db', { readonly: true });
const row = db
  .prepare('SELECT * FROM temp_files WHERE object_key = ?')
  .get(objectKey);
console.log(JSON.stringify(row, null, 2));
db.close();
