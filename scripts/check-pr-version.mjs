import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { compareVersions } from './version.mjs';
const base = process.env.PR_BASE_SHA;
if (!/^[a-f0-9]{40}$/.test(base || '')) throw new Error('PR_BASE_SHA requis.');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const changed = git('diff', '--name-only', base, 'HEAD').split('\n');
const runtimeChanged = changed.some((path) =>
  /^(apps\/|packages\/|docker\/|database\/|compose)/.test(path),
);
const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
const previous = JSON.parse(git('show', `${base}:package.json`)).version;
if (compareVersions(current, previous) < 0 || (runtimeChanged && current === previous))
  throw new Error(
    'Modification applicative : augmenter la version commune et compléter le CHANGELOG.',
  );
console.log(`Version PR vérifiée : ${current}`);
