import { test, expect, type Page } from './fixtures';
import { mockSpace } from './pwa-space';

// This fixture simulates the authentication server. A service worker can take
// ownership of WebKit requests and bypass page.route; real login is covered by
// pwa-mobile.test.ts against Docker with service workers enabled.
test.use({ serviceWorkers: 'block' });

const key = 'alf:pwa:remembered-account';
const password = 'Test-password-only';
async function auth(page: Page) {
  await mockSpace(page);
  let connected = false;
  const attempts: { login: string; password: string }[] = [];
  await page.route('**/api/v1/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/demo')) return route.fulfill({ json: { isDemo: false } });
    if (path.endsWith('/logout') || path.endsWith('/forget-device')) {
      connected = false;
      return route.fulfill({ json: { ok: true } });
    }
    const actor = { id: 'actor', name: 'Awa Fall', login: 'membre.awa', isSuper: false };
    if (path.endsWith('/me'))
      return route.fulfill({
        status: connected ? 200 : 401,
        json: connected ? actor : { message: 'Session expirée' },
      });
    if (path.endsWith('/login')) {
      const body = route.request().postDataJSON();
      attempts.push(body);
      connected = body.login === actor.login && body.password === password;
      return route.fulfill({
        status: connected ? 201 : 401,
        json: connected ? actor : { message: 'Identifiant ou mot de passe incorrect.' },
      });
    }
    return route.abort();
  });
  return {
    attempts,
    expire: () => {
      connected = false;
    },
  };
}

test('première connexion puis mot de passe seul, validation au clavier et session expirée', async ({
  page,
}) => {
  const server = await auth(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Code PIN', exact: true })).toHaveCount(0);
  await page.getByLabel('Identifiant', { exact: true }).fill('membre.awa');
  await page.getByLabel('Identifiant', { exact: true }).press('Enter');
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeFocused();
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByLabel('Mot de passe', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)).toEqual({
    login: 'membre.awa',
    name: 'Awa Fall',
  });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(password);
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(page.getByLabel('Identifiant', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveAttribute(
    'enterkeyhint',
    'go',
  );
  await page.getByLabel('Mot de passe', { exact: true }).fill('incorrect');
  await page.getByLabel('Mot de passe', { exact: true }).press('Enter');
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByLabel('Mot de passe', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  server.expire();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeEmpty();
  expect(server.attempts.map((a) => a.login)).toEqual(['membre.awa', 'membre.awa', 'membre.awa']);
  await page.screenshot({
    path: test.info().outputPath('connexion-mot-de-passe.png'),
    fullPage: true,
  });
});

test('changer de compte efface l’identité, un échec ne mémorise aucun compte', async ({ page }) => {
  await auth(page);
  await page.addInitScript(
    ({ key }) =>
      localStorage.setItem(key, JSON.stringify({ login: 'membre.awa', name: 'Awa Fall' })),
    { key },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Changer de compte / oublier cet appareil' }).click();
  await expect(page.getByLabel('Identifiant', { exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  await page.getByLabel('Identifiant', { exact: true }).fill('autre.compte');
  await page.getByLabel('Mot de passe', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
});

test('connexion possible sans stockage local et donnée mémorisée invalide ignorée', async ({
  page,
}) => {
  await auth(page);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage disabled');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage disabled');
    };
  });
  await page.goto('/');
  await page.getByLabel('Identifiant', { exact: true }).fill('membre.awa');
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByLabel('Identifiant', { exact: true })).toBeVisible();
});

test('un compte mémorisé mal formé ne bloque pas la première connexion', async ({ page }) => {
  await auth(page);
  await page.addInitScript(({ key }) => localStorage.setItem(key, '{malformed'), { key });
  await page.goto('/');
  await expect(page.getByLabel('Identifiant', { exact: true })).toBeVisible();
});
