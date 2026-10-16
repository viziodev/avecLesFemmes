import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { packages, root, validVersion, compareVersions } from './version.mjs';

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
      'docker/render.Dockerfile',
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
test('la progression des versions respecte les préversions SemVer', () => {
  const ordered = [
    '0.1.2',
    '0.1.3-alpha',
    '0.1.3-alpha.1',
    '0.1.3-alpha.2',
    '0.1.3-alpha.10',
    '0.1.3-beta',
    '0.1.3',
    '0.2.0',
    '1.0.0',
  ];
  for (let i = 1; i < ordered.length; i++) {
    assert.equal(compareVersions(ordered[i - 1], ordered[i]), -1);
    assert.equal(compareVersions(ordered[i], ordered[i - 1]), 1);
  }
  assert.equal(compareVersions('1.0.0-beta.1', '1.0.0-beta.1'), 0);
});
test('une montée de version synchronise les six packages et les images sans changer l’API', () =>
  fixture((dir, run) => {
    assert.equal(run('check').status, 0);
    assert.equal(run('set', '9.8.7').status, 0);
    assert.notEqual(run('check').status, 0, 'le changelog doit être complété');
    const log = join(dir, 'CHANGELOG.md');
    writeFileSync(log, readFileSync(log, 'utf8') + '\n## 9.8.7\n\nCorrectif de test.\n');
    assert.equal(run('check').status, 0);
    const version = readFileSync(join(dir, 'apps/api/src/version.ts'), 'utf8');
    assert.match(version, /PRODUCT_VERSION = '9.8.7'/);
    assert.match(version, /API_VERSION = '1.0.0'/);
    const compose = readFileSync(join(dir, 'compose.yaml'), 'utf8');
    assert.equal(compose.includes('APP_VERSION:-9.8.7'), true);
  }));
test('un package désynchronisé bloque la livraison', () =>
  fixture((dir, run) => {
    const original = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
    const file = join(dir, 'apps/membres-pwa/package.json');
    const value = JSON.parse(readFileSync(file, 'utf8'));
    value.version = '9.0.0';
    writeFileSync(file, JSON.stringify(value));
    assert.notEqual(run('check').status, 0);
    assert.notEqual(run('set', '9.8.7').status, 0);
    assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version, original);
  }));
