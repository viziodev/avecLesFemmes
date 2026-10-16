import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { checkVersion } from './version.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const version = checkVersion();
const tag = `v${version}`;
const head = git('rev-parse', 'HEAD');
let publish = false;
if (process.env.GITHUB_REF === 'refs/heads/main') {
  const existing = git('tag', '--list', tag);
  if (!existing) {
    git('config', 'user.name', 'github-actions[bot]');
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    git('tag', '-a', tag, '-m', `AvecLesFemmes ${version}`);
    try {
      git('push', 'origin', `refs/tags/${tag}`);
    } catch (error) {
      throw new Error(
        `Échec de la publication du tag ${tag} : ${error.message}. ` +
          `Vérifier que les permissions GitHub Actions sont configurées sur "Read and write permissions" ` +
          `(Settings > Actions > General > Workflow permissions) et que les règles de protection des tags autorisent l’action.`,
      );
    }
    publish = true;
  } else {
    // Une PR documentaire peut conserver la version publiée.
    git('merge-base', '--is-ancestor', `${tag}^{commit}`, head);
  }
} else if (process.env.GITHUB_REF === `refs/tags/${tag}`) {
  if (git('rev-parse', `${tag}^{commit}`) !== head) throw new Error('Tag incohérent.');
  publish = true;
} else throw new Error('Livraison autorisée seulement depuis main ou son tag de version.');
appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\npublish=${publish}\n`);
console.log(publish ? `Publication demandée : ${tag}` : `Version déjà taguée : ${tag}`);
