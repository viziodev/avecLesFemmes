// Environnement de qualification jetable ; ne lit ni ne remplace le .env de Nguith.
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
const version = JSON.parse(readFileSync('package.json')).version;
const file = `.releases/v${version}.test.env`;
mkdirSync('.releases', { recursive: true });
if (!existsSync(file)) {
  const owner = randomBytes(20).toString('hex'),
    app = randomBytes(20).toString('hex');
  writeFileSync(
    file,
    `APP_VERSION=${version}\nPOSTGRES_PASSWORD=${owner}\nAPP_DATABASE_PASSWORD=${app}\nDEMO_PASSWORD=${randomBytes(16).toString('hex')}\nOTP_SECRET=${randomBytes(32).toString('hex')}\nMIGRATION_DATABASE_URL=postgresql://postgres:${owner}@localhost:15433/aveclesfemmes\nDATABASE_URL=postgresql://aveclesfemmes_app:${app}@localhost:15433/aveclesfemmes\nWEB_URL=http://localhost:18085\nPWA_URL=http://localhost:18086\n`,
    { mode: 0o600, flag: 'wx' },
  );
}
const env = { ...process.env, ...parse(readFileSync(file)) };
const compose = [
  'docker',
  'compose',
  '--env-file',
  file,
  '-p',
  'aveclesfemmes-release-test',
  '-f',
  'compose.release-test.yaml',
];
const [mode, ...args] = process.argv.slice(2);
const run = (cmd) => {
  const result = spawnSync(cmd[0], cmd.slice(1), { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
if (mode === 'up') {
  run([
    ...compose,
    'up',
    '-d',
    '--wait',
    'db',
    'api',
    'super-admin-web',
    'membres-pwa',
    'render-test',
  ]);
  run([...compose, 'run', '--rm', 'seed']);
} else if (mode === 'down') run([...compose, 'down', '--volumes']);
else if (mode === 'exec' && args.length) run(args);
else throw new Error('release-test.mjs up | down | exec COMMANDE ...');
