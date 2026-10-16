import { readFileSync, writeFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const write = (path, value) =>
  writeFileSync(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
export function packages() {
  return [
    'package.json',
    ...['apps', 'packages'].flatMap((base) =>
      readdirSync(resolve(root, base), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${base}/${entry.name}/package.json`),
    ),
  ];
}
export function validVersion(value) {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?$/.exec(value);
  return (
    !!match &&
    match.slice(1, 4).every((v) => Number.isSafeInteger(Number(v))) &&
    (!match[4] ||
      match[4].split('.').every((v) => !/^\d+$/.test(v) || v === '0' || !v.startsWith('0')))
  );
}
export function compareVersions(left, right) {
  if (!validVersion(left) || !validVersion(right)) throw new Error('Versions SemVer requises.');
  const split = (v) => {
    const i = v.indexOf('-');
    return i < 0 ? [v, ''] : [v.slice(0, i), v.slice(i + 1)];
  };
  const [lc, lp] = split(left),
    [rc, rp] = split(right);
  const a = lc.split('.').map(Number),
    b = rc.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
  if (lp === rp) return 0;
  if (!lp || !rp) return lp ? -1 : 1;
  const x = lp.split('.'),
    y = rp.split('.');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === y[i]) continue;
    if (x[i] === undefined || y[i] === undefined) return x[i] === undefined ? -1 : 1;
    const nx = /^\d+$/.test(x[i]),
      ny = /^\d+$/.test(y[i]);
    if (nx !== ny) return nx ? -1 : 1;
    if (nx)
      return x[i].length !== y[i].length
        ? Math.sign(x[i].length - y[i].length)
        : x[i] < y[i]
          ? -1
          : 1;
    return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}
export function checkVersion() {
  const version = read('package.json').version;
  if (!validVersion(version)) throw new Error('Version SemVer invalide.');
  const files = packages();
  const names = new Set(files.map((file) => read(file).name));
  const lock = read('package-lock.json');
  if (lock.version !== version || lock.packages[''].version !== version)
    throw new Error('Version du verrou incohérente.');
  for (const file of files) {
    const value = read(file);
    if (value.version !== version) throw new Error(`Version incohérente : ${file}`);
    if (
      file !== 'package.json' &&
      lock.packages[file.replace('/package.json', '')]?.version !== version
    )
      throw new Error(`Verrou incohérent : ${file}`);
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(value[key] || {})) {
        if (names.has(name) && range !== version)
          throw new Error(`Dépendance interne incohérente : ${file} ${name}`);
      }
    }
  }
  const source = readFileSync(resolve(root, 'apps/api/src/version.ts'), 'utf8');
  if (!source.includes(`PRODUCT_VERSION = '${version}'`))
    throw new Error('Version API produit incohérente.');
  const compose = readFileSync(resolve(root, 'compose.yaml'), 'utf8');
  if ([...compose.matchAll(/APP_VERSION:-([^}]+)/g)].some((m) => m[1] !== version))
    throw new Error('Version Compose incohérente.');
  if (!readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8').includes(`## ${version}`))
    throw new Error('Ajouter cette version au CHANGELOG.');
  return version;
}
function setVersion(version) {
  checkVersion();
  if (!validVersion(version))
    throw new Error('Fournir une version SemVer, par exemple 0.1.1 ou 1.0.0-beta.1.');
  const files = packages();
  const names = new Set(files.map((file) => read(file).name));
  const lock = read('package-lock.json');
  for (const file of files) {
    const value = read(file);
    value.version = version;
    const lockEntry =
      lock.packages[file === 'package.json' ? '' : file.replace('/package.json', '')];
    if (!lockEntry) throw new Error(`Entrée du verrou manquante : ${file}`);
    lockEntry.version = version;
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(value[key] || {})) {
        if (names.has(name)) {
          value[key][name] = version;
          if (lockEntry[key]?.[name]) lockEntry[key][name] = version;
        }
      }
    }
    write(file, value);
  }
  lock.version = version;
  write('package-lock.json', lock);
  const sourceFile = resolve(root, 'apps/api/src/version.ts');
  writeFileSync(
    sourceFile,
    readFileSync(sourceFile, 'utf8').replace(
      /PRODUCT_VERSION = '[^']+'/,
      `PRODUCT_VERSION = '${version}'`,
    ),
  );
  const composeFile = resolve(root, 'compose.yaml');
  writeFileSync(
    composeFile,
    readFileSync(composeFile, 'utf8').replace(/APP_VERSION:-[^}]+/g, `APP_VERSION:-${version}`),
  );
  for (const file of [
    'docker/api.Dockerfile',
    'docker/web.Dockerfile',
    'docker/render.Dockerfile',
  ]) {
    const path = resolve(root, file);
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        /ARG PRODUCT_VERSION=[^\n]+/,
        `ARG PRODUCT_VERSION=${version}`,
      ),
    );
  }
  console.log(`Version synchronisée : ${version}. Compléter le CHANGELOG avant version:check.`);
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'set') setVersion(process.argv[3]);
    else if (!process.argv[2] || process.argv[2] === 'check')
      console.log(`Versions cohérentes : ${checkVersion()}`);
    else throw new Error('Usage : version.mjs check | set VERSION');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
