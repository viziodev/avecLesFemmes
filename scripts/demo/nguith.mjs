// Réinitialisation explicitement demandée pour la base Docker Compose LOCALE.
import { Pool } from 'pg';
import { parse } from 'dotenv';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetNguith } from './nguith-data.mjs';

if (!process.argv.includes('--reset-local') || process.env.NODE_ENV === 'production')
  throw new Error('Utilisation locale uniquement : node scripts/demo/nguith.mjs --reset-local');
const env = parse(readFileSync('.env'));
const credentials = parse(readFileSync('.env.nguith'));
if (
  !env.POSTGRES_PASSWORD ||
  !credentials.NGUITH_PASSWORD ||
  credentials.NGUITH_PASSWORD.length < 12 ||
  !/^\d{4}$/.test(credentials.NGUITH_PIN || '')
)
  throw new Error(
    'Configurer .env.nguith : NGUITH_PASSWORD (12 caractères minimum), NGUITH_PIN (4 chiffres).',
  );

const dir = join(tmpdir(), 'aveclesfemmes-sauvegardes');
mkdirSync(dir, { recursive: true, mode: 0o700 });
const backup = join(dir, `avant-nguith-${Date.now()}.dump`);
const dump = spawnSync(
  'docker',
  ['compose', 'exec', '-T', 'db', 'pg_dump', '-U', 'postgres', '-Fc', 'aveclesfemmes'],
  { maxBuffer: 128 * 1024 * 1024 },
);
if (dump.status !== 0 || !dump.stdout?.length)
  throw new Error('Sauvegarde locale impossible ; aucune donnée supprimée.');
writeFileSync(backup, dump.stdout, { mode: 0o600, flag: 'wx' });

// Ne lit jamais DATABASE_URL/Neon : seul le port loopback du Compose est ciblé.
const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  user: 'postgres',
  password: env.POSTGRES_PASSWORD,
  database: 'aveclesfemmes',
});
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query('SELECT pg_advisory_xact_lock(714027)');
  if (
    !(await c.query("SELECT 1 FROM schema_migrations WHERE name='017_monthly_weekday.sql'"))
      .rowCount
  )
    throw new Error('Appliquer la migration 017 avant la réinitialisation.');
  const result = await resetNguith(c, credentials);
  await c.query('COMMIT');
  console.log(JSON.stringify({ backup, ...result }, null, 2));
} catch (error) {
  await c.query('ROLLBACK');
  throw error;
} finally {
  c.release();
  await pool.end();
}
