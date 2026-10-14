import '../config';
import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
export async function migrate() {
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL obligatoire');
  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(714026)');
    await c.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const dir = resolve(process.env.MIGRATIONS_DIR || '../../database/migrations');
    for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
      const sql = await readFile(resolve(dir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await c.query('SELECT checksum FROM schema_migrations WHERE name=$1', [
        file,
      ]);
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Migration modifiée : ${file}`);
        continue;
      }
      await c.query('BEGIN');
      try {
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
          file,
          checksum,
        ]);
        await c.query('COMMIT');
        console.log(`Migration appliquée : ${file}`);
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await c.query('SELECT pg_advisory_unlock(714026)');
    c.release();
    await pool.end();
  }
}
if (require.main === module)
  migrate().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
