import { test, expect, type Page } from './fixtures';
import { mockSpace } from './pwa-space';
const password = process.env.DEMO_PASSWORD || 'Test-password-only';
const initialCode = '2468';
const vaultHeaders = { 'X-ALF-Vault-Key': 'a'.repeat(64) };
test.use({ serviceWorkers: 'block', autoSetupSecretCode: false, autoConfirmSensitive: false });
async function codeServer(page: Page) {
  await mockSpace(page);
  let code = '',
    configurations = 0,
    codeLogins = 0;
  const actor = () => ({
    id: 'actor',
    login: 'mock.user',
    name: 'Awa Fall',
    isSuper: false,
    hasSecretCode: !!code,
  });
  await page.route('**/api/v1/auth/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/demo')) return r.fulfill({ json: { isDemo: false } });
    if (path.endsWith('/me')) return r.fulfill({ json: actor() });
    if (
      path.endsWith('/activity') ||
      path.endsWith('/lock') ||
      path.endsWith('/logout') ||
      path.endsWith('/forget-device')
    )
      return r.fulfill({ status: 201, json: { ok: true } });
    const body = r.request().postDataJSON();
    if (path.endsWith('/login/secret-code')) {
      codeLogins++;
      return body.code === code && code
        ? r.fulfill({ status: 201, headers: vaultHeaders, json: actor() })
        : r.fulfill({ status: 401, json: { message: 'Code secret incorrect.' } });
    }
    if (path.endsWith('/secret-code')) {
      if (body.password !== password)
        return r.fulfill({ status: 401, json: { message: 'Mot de passe initial incorrect.' } });
      code = body.code;
      configurations++;
      return r.fulfill({ status: 201, headers: vaultHeaders, json: actor() });
    }
    if (path.endsWith('/login'))
      return body.password === password
        ? r.fulfill({ status: 201, headers: vaultHeaders, json: actor() })
        : r.fulfill({ status: 401, json: { message: 'Mot de passe incorrect.' } });
    return r.abort();
  });
  return { configurations: () => configurations, codeLogins: () => codeLogins };
}
async function firstConnection(page: Page) {
  await page.goto('/');
  await page.getByLabel('Identifiant', { exact: true }).fill('mock.user');
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choisissez votre code secret' })).toBeVisible();
}
async function chooseCode(page: Page, code = initialCode) {
  await page.getByLabel('Code secret', { exact: true }).fill(code);
  await expect(page.getByRole('heading', { name: 'Confirmez votre code secret' })).toBeVisible();
  await page.getByLabel('Code secret', { exact: true }).fill(code);
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
}
async function payment(page: Page) {
  await page.getByRole('button', { name: 'Faire un versement', exact: true }).click();
  await page.getByRole('button', { name: 'Vérifier mon versement', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
}

test('code : choix confirmé, pavé, retour arrière et réouverture par code seul', async ({
  page,
}) => {
  const server = await codeServer(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await firstConnection(page);
  await page.getByLabel('Code secret', { exact: true }).fill(initialCode);
  await page.getByLabel('Code secret', { exact: true }).fill('1357');
  await expect(page.getByRole('alert')).toContainText('différents');
  expect(server.configurations()).toBe(0);
  await page.getByLabel('Code secret', { exact: true }).fill(initialCode);
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  expect(server.configurations()).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(page.getByLabel('Identifiant', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveCount(0);
  const pad = page.getByLabel('Pavé numérique', { exact: true });
  await pad.getByRole('button', { name: '2', exact: true }).tap();
  await pad.getByRole('button', { name: '4', exact: true }).tap();
  await expect(page.locator('.secret-code-dots .filled')).toHaveCount(2);
  expect(server.codeLogins()).toBe(0);
  await pad.getByRole('button', { name: 'Effacer le dernier chiffre' }).tap();
  await expect(page.getByLabel('Code secret', { exact: true })).toHaveValue('2');
  const help = await page
    .getByRole('button', { name: 'Code secret oublié ?', exact: true })
    .boundingBox();
  expect(help!.y + help!.height).toBeLessThanOrEqual(800);
  await page.screenshot({ path: test.info().outputPath('connexion-code-clair.png') });
  await page.getByLabel('Code secret', { exact: true }).fill('0000');
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await expect(page.getByLabel('Code secret', { exact: true })).toBeEmpty();
  await page.getByLabel('Code secret', { exact: true }).fill(initialCode);
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('code : confirmation sensible annulable, code seul transmis et reçu après validation', async ({
  page,
}) => {
  await codeServer(page);
  await page.addInitScript(() => localStorage.setItem('alf:pwa:appearance', 'dark'));
  let writes = 0;
  await page.route('**/contributions/self', (r) => {
    writes++;
    expect(r.request().headers()['x-confirm-secret-code']).toBe(initialCode);
    expect(r.request().headers()['x-confirm-password']).toBeUndefined();
    return r.fulfill({
      status: 201,
      json: {
        id: 'saved',
        reference: 'CODE-TEST',
        name: 'Awa Fall',
        amount: '1500',
        paid_on: '2026-10-22',
        voided_at: null,
      },
    });
  });
  await firstConnection(page);
  await chooseCode(page);
  await payment(page);
  const confirm = page.getByRole('dialog', { name: 'Confirmer avec mon code secret', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByLabel('Code secret de confirmation').fill('24');
  const contrast = await confirm
    .locator('.secret-code-dots .filled')
    .first()
    .evaluate((el) => {
      const luminance = (color: string) => {
        const channels = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const dot = luminance(getComputedStyle(el).backgroundColor),
        background = luminance(getComputedStyle(el.closest('.dialog-card')!).backgroundColor);
      return (Math.max(dot, background) + 0.05) / (Math.min(dot, background) + 0.05);
    });
  expect(contrast).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: test.info().outputPath('confirmation-code-sombre.png') });
  expect(writes).toBe(0);
  await confirm.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
  await confirm.getByLabel('Code secret de confirmation').fill(initialCode);
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toContainText('CODE-TEST');
  expect(writes).toBe(1);
});

test('code : hors ligne, conservation du brouillon après récupération et synchronisation', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await codeServer(page);
  let syncedCode = '';
  await page.route('**/contributions/self', (r) => {
    syncedCode = r.request().headers()['x-confirm-secret-code'];
    return r.fulfill({
      status: 201,
      json: {
        id: 'saved',
        reference: 'CODE-OFFLINE',
        amount: '1500',
        paid_on: '2026-10-22',
        name: 'Awa Fall',
        voided_at: null,
      },
    });
  });
  await firstConnection(page);
  await chooseCode(page);
  await expect(page.getByRole('button', { name: 'Faire un versement', exact: true })).toBeEnabled();
  await context.setOffline(true);
  await payment(page);
  await page.getByLabel('Mot de passe de confirmation').fill(password);
  await page.getByRole('button', { name: 'Confirmer l’opération', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Saisie conservée' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /1 saisie\(s\) en attente/ })).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.getByRole('button', { name: 'Code secret oublié ?', exact: true }).click();
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Réinitialiser mon code', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choisissez votre code secret' })).toBeVisible();
  await chooseCode(page, '1357');
  const encrypted = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('alf:pwa:vault:'))
      .map((k) => localStorage.getItem(k))
      .join(''),
  );
  expect(encrypted).not.toContain(password);
  expect(encrypted).not.toContain('Awa');
  expect(encrypted).not.toContain('pending');
  await page.getByRole('button', { name: /1 saisie\(s\) en attente/ }).click();
  await page.getByRole('button', { name: 'Synchroniser cette saisie', exact: true }).click();
  await page.getByLabel('Code secret de confirmation').fill('1357');
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toContainText(
    'CODE-OFFLINE',
  );
  expect(syncedCode).toBe('1357');
});

test('hors ligne : mot de passe initial requis, le PIN ne déchiffre pas le coffre', async ({
  page,
  context,
}) => {
  await codeServer(page);
  await firstConnection(page);
  await chooseCode(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.getByLabel('Code secret', { exact: true })).toHaveCount(0);
  await page.getByLabel('Mot de passe', { exact: true }).fill(initialCode);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
});

test('code : verrouillage après cinq minutes et saisie effacée', async ({ page }) => {
  await page.clock.install();
  await codeServer(page);
  await firstConnection(page);
  await chooseCode(page);
  await page.clock.fastForward(5 * 60 * 1000 + 1000);
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(page.getByLabel('Code secret', { exact: true })).toBeEmpty();
  await expect(page.getByRole('region', { name: 'Bon retour' })).toContainText('5 minutes');
});
