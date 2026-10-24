// Opérations réservées à la recette Render existante ; jamais la production Dokploy.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { Pool } from 'pg';
import { resetNguith } from './demo/nguith-data.mjs';
const version = JSON.parse(readFileSync('package.json')).version;
const mode = process.argv[2];
if (!['check', 'backup', 'migrate', 'reset-nguith'].includes(mode))
  throw new Error('neon-release.mjs check | backup | migrate | reset-nguith');
const runtime = parse(readFileSync('.releases/render-test.credentials.env'));
const owner = parse(readFileSync(`.releases/neon-owner-${version}.env`));
const target = JSON.parse(readFileSync('.releases/render-test.deployment.json'));
const appUrl = new URL(runtime.DATABASE_URL),
  ownerUrl = new URL(owner.MIGRATION_DATABASE_URL);
if (
  target.serviceId !== 'srv-db7s4l6i0phs73af6520' ||
  target.webUrl !== 'https://aveclesfemmes-test.onrender.com' ||
  target.databaseProvider !== 'neon.tech' ||
  ownerUrl.hostname !== appUrl.hostname ||
  ownerUrl.pathname !== appUrl.pathname ||
  !ownerUrl.hostname.startsWith(target.databaseId + '.') ||
  !ownerUrl.hostname.endsWith('.neon.tech') ||
  ownerUrl.username !== 'neondb_owner' ||
  appUrl.username !== 'aveclesfemmes_app'
)
  throw new Error('Cible différente de la seule base Neon de recette autorisée.');
ownerUrl.searchParams.set('sslmode', 'verify-full');
const pool = new Pool({ connectionString: ownerUrl.toString(), connectionTimeoutMillis: 20000 });
const c = await pool.connect();
const report = `.releases/neon-${version}.preflight.json`;
const beforeReset = mode === 'reset-nguith' || process.argv.includes('--before-reset');
const backupPath = `.releases/neon-before-v${version}${beforeReset ? '-reset' : ''}.dump`;
try {
  const current = (await c.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
  const files = readdirSync('database/migrations')
    .filter((x) => x.endsWith('.sql'))
    .sort();
  for (const old of current) {
    if (
      !files.includes(old.name) ||
      createHash('sha256')
        .update(readFileSync('database/migrations/' + old.name))
        .digest('hex') !== old.checksum
    )
      throw new Error('Migration distante différente : ' + old.name);
  }
  const roles = (
    await c.query(
      "SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='aveclesfemmes_app'",
    )
  ).rows[0];
  if (!roles || roles.rolsuper || roles.rolbypassrls)
    throw new Error('Rôle applicatif de recette non isolé.');
  const pending = files.filter((x) => !current.some((m) => m.name === x));
  if (mode === 'check') {
    const counts = (
      await c.query(
        'SELECT (SELECT count(*)::int FROM groupements) groupements,(SELECT count(*)::int FROM campaigns) campagnes,(SELECT count(*)::int FROM contributions) versements',
      )
    ).rows[0];
    const result = {
      version,
      host: ownerUrl.hostname,
      database: ownerUrl.pathname.slice(1),
      migrations: current.map((x) => x.name),
      pending,
      roles,
      counts,
    };
    writeFileSync(report, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(result));
  } else if (mode === 'backup') {
    if (existsSync(backupPath))
      throw new Error('Sauvegarde existante ; aucun écrasement autorisé.');
    const caFile = '.releases/neon-ca.pem';
    const caSource = ['/etc/ssl/cert.pem', '/etc/ssl/certs/ca-certificates.crt'].find(existsSync);
    if (!caSource) throw new Error('Certificats racines système introuvables.');
    writeFileSync(caFile, readFileSync(caSource), { mode: 0o600 });
    const pgEnv = `PGHOST=${ownerUrl.hostname}\nPGDATABASE=${decodeURIComponent(ownerUrl.pathname.slice(1))}\nPGUSER=${decodeURIComponent(ownerUrl.username)}\nPGPASSWORD=${decodeURIComponent(ownerUrl.password)}\nPGSSLMODE=verify-full\nPGSSLROOTCERT=/etc/ssl/certs/ca-certificates.crt\n`;
    const pgFile = `.releases/neon-${version}.pg.env`;
    writeFileSync(pgFile, pgEnv, { mode: 0o600 });
    const image =
      'postgres:18-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c';
    const dump = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--env-file',
        pgFile,
        '--mount',
        `type=bind,source=${process.cwd()}/${caFile},target=/etc/ssl/certs/ca-certificates.crt,readonly`,
        image,
        'pg_dump',
        '-Fc',
      ],
      { maxBuffer: 256 * 1024 * 1024 },
    );
    if (dump.status !== 0 || !dump.stdout?.length) {
      const reason = (dump.stderr?.toString() || 'pg_dump sans sortie')
        .replaceAll(decodeURIComponent(ownerUrl.password), '[secret]')
        .replaceAll(ownerUrl.password, '[secret]')
        .slice(-1200);
      throw new Error('Sauvegarde Neon échouée ; données inchangées. ' + reason);
    }
    const verify = spawnSync('docker', ['run', '--rm', '-i', image, 'pg_restore', '--list'], {
      input: dump.stdout,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (verify.status !== 0) throw new Error('Archive de sauvegarde illisible.');
    writeFileSync(backupPath, dump.stdout, { flag: 'wx', mode: 0o600 });
    writeFileSync(
      backupPath + '.json',
      JSON.stringify(
        {
          version,
          host: ownerUrl.hostname,
          database: ownerUrl.pathname.slice(1),
          sha256: createHash('sha256').update(dump.stdout).digest('hex'),
          bytes: dump.stdout.length,
          verified: true,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    );
    console.log('Sauvegarde privée vérifiée : ' + backupPath);
  } else {
    if (!existsSync(backupPath + '.json') || !existsSync(backupPath))
      throw new Error('Sauvegarde vérifiée obligatoire avant toute modification.');
    const evidence = JSON.parse(readFileSync(backupPath + '.json'));
    if (
      evidence.host !== ownerUrl.hostname ||
      !evidence.verified ||
      createHash('sha256').update(readFileSync(backupPath)).digest('hex') !== evidence.sha256
    )
      throw new Error('Sauvegarde incompatible ou modifiée.');
    if (mode === 'migrate') {
      process.env.MIGRATION_DATABASE_URL = ownerUrl.toString();
      process.env.MIGRATIONS_DIR = 'database/migrations';
      const { migrate } = await import('../apps/api/dist/database/migrate.js');
      await migrate();
    } else {
      if (Date.now() - Date.parse(evidence.createdAt) > 15 * 60_000)
        throw new Error(
          'Sauvegarde avant remplacement trop ancienne ; en créer une nouvelle sans écraser les archives.',
        );
      if (pending.length)
        throw new Error('Appliquer toutes les migrations avant la réinitialisation.');
      const live = await fetch(target.webUrl + '/api/v1/health/live', {
        signal: AbortSignal.timeout(60000),
      });
      if (!live.ok || (await live.json()).version !== version)
        throw new Error('La version cible doit être en ligne avant de remplacer les données.');
      const credentials = parse(readFileSync('.env.nguith'));
      await c.query('BEGIN');
      try {
        await c.query("SET LOCAL lock_timeout='10s'");
        await c.query('SELECT pg_advisory_xact_lock(714027)');
        await c.query(
          'LOCK TABLE groupements,memberships,campaigns,participations,contributions,tontine_rounds,savings_sessions,sessions,trusted_devices IN ACCESS EXCLUSIVE MODE',
        );
        const result = await resetNguith(c, credentials);
        await c.query('COMMIT');
        mkdirSync('docs/recette/release-1.0.0', { recursive: true });
        const publicResult = {
          version,
          environment: 'Render gratuit + Neon de recette',
          ...result,
          backupSha256: evidence.sha256,
          completedAt: new Date().toISOString(),
        };
        writeFileSync(
          'docs/recette/release-1.0.0/nguith.json',
          JSON.stringify(publicResult, null, 2) + '\n',
        );
        console.log(JSON.stringify(publicResult));
      } catch (error) {
        await c.query('ROLLBACK');
        throw error;
      }
    }
  }
} finally {
  c.release();
  await pool.end();
}
