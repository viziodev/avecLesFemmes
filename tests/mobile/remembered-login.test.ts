import { test, expect, loginPwa, type Page } from './fixtures';
import { mockSpace } from './pwa-space';
import { forgetDeviceAsSuperAdmin } from './device-administration';

test.use({ serviceWorkers: 'block' });
const key = 'alf:pwa:remembered-account';
const password = 'Test-password-only';
const pin = '1379';
const phone = '+221770000003';
async function auth(page: Page, responsible = false) {
  await mockSpace(page, responsible);
  let connected = false;
  const attempts: { phone: string; pin: string }[] = [];
  const actor = {
    id: 'actor',
    name: 'Awa Fall',
    login: 'membre.awa',
    phone,
    hasSecretCode: true,
    isSuper: false,
  };
  await page.route('**/api/v1/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/demo')) return route.fulfill({ json: { isDemo: false } });
    if (path.endsWith('/forget-device')) {
      const body = route.request().postDataJSON();
      if (body.login !== 'superadmin' || body.password !== password)
        return route.fulfill({
          status: 403,
          json: { message: 'Opération réservée au Super Admin.' },
        });
      connected = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith('/logout') || path.endsWith('/lock')) {
      connected = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith('/activity')) return route.fulfill({ json: { ok: true } });
    if (path.endsWith('/me'))
      return route.fulfill({
        status: connected ? 200 : 401,
        json: connected ? actor : { message: 'Session expirée' },
      });
    if (path.endsWith('/login/phone-pin')) {
      const body = route.request().postDataJSON();
      attempts.push(body);
      connected = body.phone === phone && body.pin === pin;
      return route.fulfill({
        status: connected ? 201 : 401,
        headers: connected ? { 'X-ALF-Vault-Key': 'a'.repeat(64) } : {},
        json: connected ? actor : { message: 'Identifiants incorrects.' },
      });
    }
    return route.abort();
  });
  return { attempts };
}

for (const responsible of [false, true]) {
  test(`${responsible ? 'admin groupement' : 'membre'} : téléphone puis PIN existant, ensuite PIN seul`, async ({
    page,
  }) => {
    const server = await auth(page, responsible);
    await page.goto('/');
    await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveCount(0);
    await page.getByLabel('Numéro de téléphone', { exact: true }).fill('77 000 00 03');
    await page.getByLabel('Numéro de téléphone', { exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Votre PIN', exact: true })).toBeVisible();
    expect(server.attempts).toHaveLength(0);
    await page.getByLabel('Code secret', { exact: true }).fill('0000');
    await expect(page.getByRole('alert')).toContainText('incorrects');
    await expect(page.getByLabel('Code secret', { exact: true })).toBeEmpty();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    await page.getByLabel('Code secret', { exact: true }).fill(pin);
    await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
    expect(server.attempts[1]).toEqual({ phone, pin });
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)).toEqual({
      login: 'membre.awa',
      name: 'Awa Fall',
      phone,
      hasSecretCode: true,
    });
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Bon retour', exact: true })).toBeVisible();
    await expect(page.getByLabel('Numéro de téléphone', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /Changer de compte|oublier cet appareil|Reconnecter/ }),
    ).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('retour-pin.png'), fullPage: true });
    await page.getByLabel('Code secret', { exact: true }).fill(pin);
    await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Bon retour', exact: true })).toBeVisible();
    await expect(page.getByLabel('Code secret', { exact: true })).toBeEmpty();
    expect(server.attempts.every((a) => Object.keys(a).sort().join(',') === 'phone,pin')).toBe(
      true,
    );
  });
}

test('téléphone invalide : aucune tentative et correction possible avant identification', async ({
  page,
}) => {
  const server = await auth(page);
  await page.goto('/');
  await page.getByLabel('Numéro de téléphone', { exact: true }).fill('awa');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('numéro valide');
  expect(server.attempts).toHaveLength(0);
  await page.getByLabel('Numéro de téléphone', { exact: true }).fill('00221770000003');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votre PIN', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Corriger le numéro', exact: true }).click();
  await expect(page.getByLabel('Numéro de téléphone', { exact: true })).toHaveValue(phone);
  expect(server.attempts).toHaveLength(0);
});

test('oubli réservé au Super Admin, identité et brouillons conservés après refus', async ({
  page,
}) => {
  await auth(page);
  await page.goto('/');
  await page.evaluate(
    ({ key, phone }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ login: 'membre.awa', name: 'Awa Fall', phone, hasSecretCode: true }),
      ),
    { key, phone },
  );
  await page.evaluate(() =>
    localStorage.setItem('alf:pwa:vault:membre.awa', 'encrypted-draft-to-preserve'),
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: /Changer de compte|oublier cet appareil|Reconnecter/ }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Assistance Super Admin', exact: true }).click();
  await page.getByLabel('Identifiant Super Admin').fill('membre.awa');
  await page.getByLabel('Mot de passe Super Admin').fill(password);
  await page.getByRole('button', { name: 'Confirmer l’oubli de cet appareil' }).click();
  await expect(page.getByRole('alert')).toContainText('réservée au Super Admin');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).not.toBeNull();
  await forgetDeviceAsSuperAdmin(page, password);
  await expect(page.getByLabel('Numéro de téléphone', { exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('alf:pwa:vault:membre.awa'))).toBe(
    'encrypted-draft-to-preserve',
  );
});

test('un refus serveur de révocation ne retire pas le compte mémorisé', async ({ page }) => {
  await auth(page);
  await page.goto('/');
  await page.evaluate(
    ({ key, phone }) =>
      localStorage.setItem(key, JSON.stringify({ login: 'membre.awa', name: 'Awa Fall', phone })),
    { key, phone },
  );
  await page.route('**/auth/forget-device', (route) =>
    route.fulfill({ status: 503, json: { message: 'Indisponible' } }),
  );
  await page.goto('/?administration-appareil');
  await page.getByLabel('Identifiant Super Admin').fill('superadmin');
  await page.getByLabel('Mot de passe Super Admin').fill(password);
  await page.getByRole('button', { name: 'Confirmer l’oubli de cet appareil' }).click();
  await expect(page.getByRole('alert')).toContainText('non révoqué');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).not.toBeNull();
});

test('connexion téléphone/PIN possible sans stockage local', async ({ page }) => {
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
  await loginPwa(page, phone, { pin, prepareOffline: false });
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByLabel('Numéro de téléphone', { exact: true })).toBeVisible();
});

test('un compte mémorisé mal formé ne bloque pas la première connexion téléphone', async ({
  page,
}) => {
  await auth(page);
  await page.addInitScript(({ key }) => localStorage.setItem(key, '{malformed'), { key });
  await page.goto('/');
  await expect(page.getByLabel('Numéro de téléphone', { exact: true })).toBeVisible();
});
