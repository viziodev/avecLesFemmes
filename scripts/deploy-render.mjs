import { readFileSync, realpathSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export function validateManifest(manifest, version, commit, repository) {
  const image = manifest.images?.render?.registryDigest;
  const prefix = `ghcr.io/${repository.toLowerCase()}-render@sha256:`;
  if (
    manifest.kind !== 'registry-release' ||
    manifest.version !== version ||
    manifest.commit !== commit ||
    !image?.startsWith(prefix) ||
    !/^[a-f0-9]{64}$/.test(image.slice(prefix.length))
  )
    throw new Error('Manifeste Render incompatible, non figé ou provenant d’un autre commit.');
  return image;
}

export function validateServiceConfig(service, expectedImagePath, isInitialDeploy = false) {
  if (service.type !== 'web_service' || service.serviceDetails?.plan !== 'free')
    throw new Error('Le service cible doit être le conteneur unique Render gratuit attendu.');
  const expectedPrefix = expectedImagePath.split('@')[0] + '@';
  if (!isInitialDeploy && !service.imagePath?.startsWith(expectedPrefix))
    throw new Error('Le service cible doit être le conteneur unique Render gratuit attendu.');
}

export function checkMigrationPreconditions({
  previousVersion,
  currentVersion,
  commit,
  migrationsDiff,
  migrationsReadyVersion,
  isInitialDeploy = false,
  origin,
}) {
  if (!previousVersion) {
    if (!isInitialDeploy) {
      throw new Error(
        `Impossible de joindre la version actuellement déployée sur ${origin}. Si c’est un premier déploiement ou une réinitialisation de la base, renseigner INITIAL_DEPLOY=true et MIGRATIONS_READY_VERSION=${currentVersion}.`,
      );
    }
    if (migrationsReadyVersion !== currentVersion) {
      throw new Error(
        `Premier déploiement : appliquer les migrations initiales puis confirmer MIGRATIONS_READY_VERSION=${currentVersion}.`,
      );
    }
    return { isInitial: true };
  }
  if (migrationsDiff && migrationsReadyVersion !== currentVersion) {
    throw new Error(
      `Appliquer les migrations séparément puis confirmer MIGRATIONS_READY_VERSION=${currentVersion}.`,
    );
  }
  return { isInitial: false };
}

async function main() {
  const {
    RENDER_API_KEY: key,
    RENDER_SERVICE_ID: serviceId,
    RENDER_PUBLIC_URL: publicUrl,
    INITIAL_DEPLOY: initialDeployVar,
    MIGRATIONS_READY_VERSION: migrationsReadyVersion,
  } = process.env;
  const isInitialDeploy = initialDeployVar === 'true';
  if (!key || !/^srv-[a-z0-9]+$/.test(serviceId || ''))
    throw new Error(
      'Configurer RENDER_API_KEY et RENDER_SERVICE_ID dans l’environnement GitHub render-test.',
    );
  const origin = new URL(publicUrl).origin;
  if (!/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin))
    throw new Error('URL Render HTTPS requise.');
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const manifest = JSON.parse(readFileSync(`.releases/v${version}.registry.json`, 'utf8'));
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const imagePath = validateManifest(manifest, version, commit, process.env.GITHUB_REPOSITORY);
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`https://api.render.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`API Render ${method} : HTTP ${response.status}.`);
    return response.json();
  };
  const service = await request(`/services/${serviceId}`);
  validateServiceConfig(service, imagePath, isInitialDeploy);
  const pause = () => new Promise((resolve) => setTimeout(resolve, 10000));
  const liveVersion = async () => {
    const response = await fetch(`${origin}/api/v1/health/live`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error('Version actuellement déployée indisponible.');
    return (await response.json()).version;
  };
  let previousVersion;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      previousVersion = await liveVersion();
      break;
    } catch {
      await pause();
    }
  }
  let migrations = '';
  if (previousVersion) {
    execFileSync('git', ['merge-base', '--is-ancestor', `v${previousVersion}^{commit}`, commit]);
    migrations = execFileSync(
      'git',
      ['diff', '--name-only', `v${previousVersion}^{commit}`, commit, '--', 'database/migrations'],
      { encoding: 'utf8' },
    ).trim();
  }
  const preCheck = checkMigrationPreconditions({
    previousVersion,
    currentVersion: version,
    commit,
    migrationsDiff: migrations,
    migrationsReadyVersion,
    isInitialDeploy,
    origin,
  });
  if (preCheck.isInitial) {
    console.log(`Premier déploiement autorisé (INITIAL_DEPLOY=true) : version cible ${version}.`);
  }
  const previousImage = service.imagePath;
  await request(`/services/${serviceId}`, 'PATCH', {
    autoDeployTrigger: 'off',
    image: {
      ownerId: service.ownerId,
      imagePath,
      ...(service.registryCredential?.id
        ? { registryCredentialId: service.registryCredential.id }
        : {}),
    },
  });
  const deployment = await request(`/services/${serviceId}/deploys`, 'POST', {
    imageUrl: imagePath,
  });
  console.log(`Déploiement Render : ${deployment.id}`);
  const deadline = Date.now() + 12 * 60 * 1000;
  let live = false;
  while (Date.now() < deadline) {
    const state = await request(`/services/${serviceId}/deploys/${deployment.id}`);
    if (state.status === 'live') {
      live = true;
      break;
    }
    if (
      ['build_failed', 'update_failed', 'pre_deploy_failed', 'canceled', 'deactivated'].includes(
        state.status,
      )
    )
      throw new Error(
        `Déploiement Render arrêté : ${state.status}. Image précédente : ${previousImage}`,
      );
    await pause();
  }
  if (!live || (await liveVersion()) !== version)
    throw new Error('La version attendue n’est pas en ligne.');
  const ready = await fetch(`${origin}/api/v1/health/ready`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!ready.ok) throw new Error('PostgreSQL ne répond pas au contrôle de santé.');
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `Version ${version} déployée sur ${origin}.\n\nImage : ${imagePath}\n\nImage précédente : ${previousImage}\n`,
    );
  console.log(`Render vérifié : ${version}`);
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
