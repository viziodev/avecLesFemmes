import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateManifest,
  validateServiceConfig,
  checkMigrationPreconditions,
} from './deploy-render.mjs';
const commit = 'a'.repeat(40);
const image = `ghcr.io/viziodev/aveclesfemmes-render@sha256:${'b'.repeat(64)}`;
const manifest = {
  kind: 'registry-release',
  version: '0.1.3',
  commit,
  images: { render: { registryDigest: image } },
};
test('seule l’image Render figée de la version et du commit validés est déployable', () => {
  assert.equal(validateManifest(manifest, '0.1.3', commit, 'viziodev/avecLesFemmes'), image);
  for (const altered of [
    { ...manifest, commit: 'c'.repeat(40) },
    { ...manifest, version: '0.1.2' },
    {
      ...manifest,
      images: { render: { registryDigest: 'ghcr.io/other/project@sha256:' + 'b'.repeat(64) } },
    },
    {
      ...manifest,
      images: { render: { registryDigest: 'ghcr.io/viziodev/aveclesfemmes-render:latest' } },
    },
  ])
    assert.throws(() => validateManifest(altered, '0.1.3', commit, 'viziodev/avecLesFemmes'));
});

test('contrôle de la configuration du service Render (standard et initial)', () => {
  const service = {
    type: 'web_service',
    serviceDetails: { plan: 'free' },
    imagePath: image,
  };
  assert.doesNotThrow(() => validateServiceConfig(service, image, false));

  // Service non gratuit ou mauvais type rejeté
  assert.throws(() =>
    validateServiceConfig({ ...service, serviceDetails: { plan: 'starter' } }, image, false),
  );
  assert.throws(() => validateServiceConfig({ ...service, type: 'private_service' }, image, false));

  // Premier déploiement accepte une image initiale différente
  const freshService = { ...service, imagePath: 'starter-image:latest' };
  assert.throws(() => validateServiceConfig(freshService, image, false));
  assert.doesNotThrow(() => validateServiceConfig(freshService, image, true));
});

test('contrôle des préconditions de migration (standard et premier déploiement)', () => {
  // Déploiement standard sans migration en attente
  assert.deepEqual(
    checkMigrationPreconditions({
      previousVersion: '0.1.2',
      currentVersion: '0.1.3',
      commit,
      migrationsDiff: '',
      migrationsReadyVersion: undefined,
      isInitialDeploy: false,
      origin: 'https://test.onrender.com',
    }),
    { isInitial: false },
  );

  // Déploiement standard avec migrations en attente non confirmées
  assert.throws(() =>
    checkMigrationPreconditions({
      previousVersion: '0.1.2',
      currentVersion: '0.1.3',
      commit,
      migrationsDiff: 'database/migrations/002_next.sql',
      migrationsReadyVersion: '0.1.2',
      isInitialDeploy: false,
      origin: 'https://test.onrender.com',
    }),
  );

  // Déploiement standard avec migrations en attente confirmées
  assert.deepEqual(
    checkMigrationPreconditions({
      previousVersion: '0.1.2',
      currentVersion: '0.1.3',
      commit,
      migrationsDiff: 'database/migrations/002_next.sql',
      migrationsReadyVersion: '0.1.3',
      isInitialDeploy: false,
      origin: 'https://test.onrender.com',
    }),
    { isInitial: false },
  );

  // Premier déploiement (version en ligne absente) sans INITIAL_DEPLOY -> rejeté avec message clair
  assert.throws(
    () =>
      checkMigrationPreconditions({
        previousVersion: undefined,
        currentVersion: '0.1.3',
        commit,
        migrationsDiff: '',
        migrationsReadyVersion: undefined,
        isInitialDeploy: false,
        origin: 'https://test.onrender.com',
      }),
    /INITIAL_DEPLOY=true/,
  );

  // Premier déploiement sans confirmation des migrations initiales -> rejeté
  assert.throws(
    () =>
      checkMigrationPreconditions({
        previousVersion: undefined,
        currentVersion: '0.1.3',
        commit,
        migrationsDiff: '',
        migrationsReadyVersion: undefined,
        isInitialDeploy: true,
        origin: 'https://test.onrender.com',
      }),
    /appliquer les migrations initiales/,
  );

  // Premier déploiement valide avec INITIAL_DEPLOY=true et MIGRATIONS_READY_VERSION=version
  assert.deepEqual(
    checkMigrationPreconditions({
      previousVersion: undefined,
      currentVersion: '0.1.3',
      commit,
      migrationsDiff: '',
      migrationsReadyVersion: '0.1.3',
      isInitialDeploy: true,
      origin: 'https://test.onrender.com',
    }),
    { isInitial: true },
  );
});
