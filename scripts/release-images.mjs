import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkVersion, root } from './version.mjs';

const run = (args, options = {}) =>
  execFileSync(args[0], args.slice(1), { cwd: root, encoding: 'utf8', ...options });
const version = checkVersion(),
  tag = `v${version}`,
  mode = process.argv[2] || 'check';
const images = [
  { name: 'api', service: 'api', file: 'docker/api.Dockerfile' },
  { name: 'render', service: 'render-test', file: 'docker/render.Dockerfile' },
  {
    name: 'web',
    service: 'super-admin-web',
    file: 'docker/web.Dockerfile',
    app: 'super-admin-web',
  },
  { name: 'pwa', service: 'membres-pwa', file: 'docker/web.Dockerfile', app: 'membres-pwa' },
];
try {
  if (!['check', 'build', 'publish'].includes(mode))
    throw new Error('Usage : release-images.mjs check | build | publish');
  const commit = run(['git', 'rev-parse', 'HEAD']).trim();
  if (run(['git', 'rev-parse', `${tag}^{commit}`]).trim() !== commit)
    throw new Error(`HEAD doit correspondre au tag ${tag}.`);
  if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== tag)
    throw new Error('Le tag CI ne correspond pas à la version produit.');
  const mainRef =
    spawnSync('git', ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'], { cwd: root })
      .status === 0
      ? 'origin/main'
      : 'main';
  run(['git', 'merge-base', '--is-ancestor', commit, mainRef]);
  if (run(['git', 'status', '--porcelain']).trim())
    throw new Error('La livraison exige un dépôt propre.');
  console.log(`Livraison vérifiée : ${tag} · ${commit}`);
  if (mode !== 'check') {
    const output = resolve(
      root,
      `.releases/${tag}.${mode === 'publish' ? 'registry' : 'local'}.json`,
    );
    if (existsSync(output))
      throw new Error(`Manifeste existant : ${output}. Aucun écrasement autorisé.`);
    mkdirSync(resolve(root, '.releases'), { recursive: true });
    const source =
      process.env.SOURCE_URL ||
      (process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : '');
    const manifest = {
      product: 'AvecLesFemmes',
      version,
      tag,
      commit,
      kind: mode === 'publish' ? 'registry-release' : 'local-image-inventory',
      createdAt: new Date().toISOString(),
      images: {},
    };
    if (mode === 'build') {
      run(['docker', 'compose', 'build', ...images.map((image) => image.service)], {
        stdio: 'inherit',
        env: { ...process.env, APP_VERSION: version, GIT_REVISION: commit, SOURCE_URL: source },
      });
      for (const image of images) {
        const reference = `aveclesfemmes-${image.name}:${version}`;
        const info = JSON.parse(run(['docker', 'image', 'inspect', reference]))[0];
        if (
          info.Config.Labels['org.opencontainers.image.revision'] !== commit ||
          info.Config.Labels['org.opencontainers.image.version'] !== version
        )
          throw new Error(`Métadonnées incorrectes : ${reference}`);
        manifest.images[image.name] = { reference, imageId: info.Id, registryDigest: null };
      }
    } else {
      const namespace = process.env.REGISTRY_NAMESPACE;
      if (!namespace || !/^ghcr\.io\/[a-z0-9][a-z0-9._/-]*$/.test(namespace))
        throw new Error('REGISTRY_NAMESPACE attendu : ghcr.io/compte/aveclesfemmes (minuscules).');
      for (const image of images) {
        const reference = `${namespace}-${image.name}:${version}`;
        const existing = spawnSync('docker', ['buildx', 'imagetools', 'inspect', reference], {
          encoding: 'utf8',
        });
        if (existing.status === 0)
          throw new Error(`Image déjà publiée : ${reference}. Créer une nouvelle version.`);
        if (!/not found|manifest unknown|name unknown/i.test(existing.stderr || ''))
          throw new Error(`Impossible de vérifier l’absence de ${reference} : ${existing.stderr}`);
      }
      for (const image of images) {
        const repository = `${namespace}-${image.name}`,
          reference = `${repository}:${version}`;
        const metadata = resolve(root, `.releases/${image.name}.build-metadata.json`);
        const args = [
          'docker',
          'buildx',
          'build',
          '--platform',
          'linux/amd64,linux/arm64',
          '--push',
          '--file',
          image.file,
          '--tag',
          reference,
          '--metadata-file',
          metadata,
          '--build-arg',
          `PRODUCT_VERSION=${version}`,
          '--build-arg',
          `VCS_REF=${commit}`,
          '--build-arg',
          `SOURCE_URL=${source}`,
        ];
        if (image.app) args.push('--build-arg', `APP_NAME=${image.app}`);
        args.push('.');
        run(args, { stdio: 'inherit' });
        const digest = JSON.parse(readFileSync(metadata, 'utf8'))['containerimage.digest'];
        if (!/^sha256:[a-f0-9]{64}$/.test(digest || ''))
          throw new Error(`Empreinte absente : ${reference}`);
        manifest.images[image.name] = { reference, registryDigest: `${repository}@${digest}` };
      }
    }
    writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    console.log(`Manifeste créé : ${output}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
