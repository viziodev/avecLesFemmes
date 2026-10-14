import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { packages, root, validVersion } from './version.mjs';

function fixture(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'aveclesfemmes-version-'));
  try {
    for (const file of [
      ...packages(),
      'package-lock.json',
      'scripts/version.mjs',
      'apps/api/src/version.ts',
      'compose.yaml',
      'CHANGELOG.md',
      'docker/api.Dockerfile',
      'docker/web.Dockerfile',
    ]) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      cpSync(join(root, file), join(dir, file));
    }
    const run = (...args) =>
      spawnSync(process.execPath, [join(dir, 'scripts/version.mjs'), ...args], {
        encoding: 'utf8',
      });
    callback(dir, run);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test('versions SemVer et préversions valides, valeurs ambiguës rejetées', () => {
  for (const version of ['0.1.0', '1.0.0-beta.1', '1.0.0', '2.1.3'])
    assert.equal(validVersion(version), true);
  for (const version of ['01.1.0', '1.0', '1.0.0-beta.01', 'latest', undefined])
    assert.equal(validVersion(version), false);
});
test('une montée de version synchronise les six packages et les images sans changer l’API', () =>
  fixture((dir, run) => {
    assert.equal(run('check').status, 0);
    assert.equal(run('set', '0.1.1').status, 0);
    assert.notEqual(run('check').status, 0, 'le changelog doit être complété');
    const log = join(dir, 'CHANGELOG.md');
    writeFileSync(log, readFileSync(log, 'utf8') + '\n## 0.1.1\n\nCorrectif de test.\n');
    assert.equal(run('check').status, 0);
    const version = readFileSync(join(dir, 'apps/api/src/version.ts'), 'utf8');
    assert.match(version, /PRODUCT_VERSION = '0.1.1'/);
    assert.match(version, /API_VERSION = '1.0.0'/);
    const compose = readFileSync(join(dir, 'compose.yaml'), 'utf8');
    assert.equal(compose.includes('APP_VERSION:-0.1.0'), false);
  }));
test('un package désynchronisé bloque la livraison', () =>
  fixture((dir, run) => {
    const file = join(dir, 'apps/membres-pwa/package.json');
    const value = JSON.parse(readFileSync(file, 'utf8'));
    value.version = '9.0.0';
    writeFileSync(file, JSON.stringify(value));
    assert.notEqual(run('check').status, 0);
    assert.notEqual(run('set', '0.1.1').status, 0);
    assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version, '0.1.0');
  }));
