import { expectEncryptedVault } from './vault-assertions';
import { test, expect, prepareOfflineForTest, loginPwa, type Page } from './fixtures';
import { mockSpace } from './pwa-space';
import { forgetDeviceAsSuperAdmin } from './device-administration';
const password = process.env.DEMO_PASSWORD || 'Test-password-only';
const initialCode = '2468';
test.use({ serviceWorkers: 'block', autoSetupSecretCode: false, autoConfirmSensitive: false });
async function codeServer(page: Page) {
  await mockSpace(page);
  let code = initialCode,
    configurations = 0,
    codeLogins = 0;
  let vaultKey = 'a'.repeat(64);
  const currentHeaders = () => ({ 'X-ALF-Vault-Key': vaultKey });
  const actor = () => ({
    id: 'actor',
    login: 'mock.user',
    phone: '+221770000003',
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
    if (path.endsWith('/vault/password'))
      return body.password === password
        ? r.fulfill({ headers: currentHeaders(), json: { ok: true } })
        : r.fulfill({ status: 403, json: { message: 'Mot de passe refusé.' } });
    if (path.endsWith('/login/phone-pin') || path.endsWith('/login/secret-code')) {
      codeLogins++;
      return (body.pin || body.code) === code && code
        ? r.fulfill({ status: 201, headers: currentHeaders(), json: actor() })
        : r.fulfill({ status: 401, json: { message: 'Code secret incorrect.' } });
    }
    if (path.endsWith('/secret-code')) {
      if (body.password !== password)
        return r.fulfill({ status: 401, json: { message: 'Mot de passe initial incorrect.' } });
      code = body.code;
      configurations++;
      return r.fulfill({ status: 201, headers: currentHeaders(), json: actor() });
    }
    if (path.endsWith('/login'))
      return body.password === password
        ? r.fulfill({ status: 201, headers: currentHeaders(), json: actor() })
        : r.fulfill({ status: 401, json: { message: 'Mot de passe incorrect.' } });
    return r.abort();
  });
  return {
    configurations: () => configurations,
    codeLogins: () => codeLogins,
    replaceCodeByAdmin: () => {
      code = '1357';
      vaultKey = 'b'.repeat(64);
    },
  };
}
async function firstConnection(page: Page) {
  await page.goto('/');
  await page.getByLabel('Numéro de téléphone', { exact: true }).fill('77 000 00 03');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votre PIN', exact: true })).toBeVisible();
}
async function enterPin(page: Page, code = initialCode) {
  await page.getByLabel('Code secret', { exact: true }).fill(code);
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  await prepareOfflineForTest(page, password);
}
async function payment(page: Page) {
  await page.getByRole('button', { name: 'Faire un versement', exact: true }).click();
  await page.getByRole('button', { name: 'Vérifier mon versement', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
}

test('PIN existant : pavé, retour arrière, erreurs et réouverture par PIN seul', async ({
  page,
}) => {
  const server = await codeServer(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await firstConnection(page);
  await page.getByLabel('Code secret', { exact: true }).fill('1357');
  await expect(page.getByRole('alert')).toContainText('incorrect');
  expect(server.configurations()).toBe(0);
  await enterPin(page);
  expect(server.configurations()).toBe(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(page.getByLabel('Identifiant', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveCount(0);
  const beforePartial = server.codeLogins();
  const pad = page.getByLabel('Pavé numérique', { exact: true });
  await pad.getByRole('button', { name: '2', exact: true }).tap();
  await pad.getByRole('button', { name: '4', exact: true }).tap();
  await expect(page.locator('.secret-code-dots .filled')).toHaveCount(2);
  expect(server.codeLogins()).toBe(beforePartial);
  await pad.getByRole('button', { name: 'Effacer le dernier chiffre' }).tap();
  await expect(page.getByLabel('Code secret', { exact: true })).toHaveValue('2');
  await expect(page.locator('.pwa-login-help')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Reconnecter cet appareil|Changer de compte|Code secret oublié/,
    }),
  ).toHaveCount(0);
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
  await enterPin(page);
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
  const server = await codeServer(page);
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
  await enterPin(page);
  await expect(page.getByRole('button', { name: 'Faire un versement', exact: true })).toBeEnabled();
  await context.setOffline(true);
  await payment(page);
  await page.getByLabel('Code PIN de confirmation').fill(initialCode);
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
  server.replaceCodeByAdmin();
  await forgetDeviceAsSuperAdmin(page, password);
  await loginPwa(page, '+221770000003', { pin: '1357', password });
  await expectEncryptedVault(page);
  await page.getByRole('button', { name: /1 saisie\(s\) en attente/ }).click();
  await page.getByRole('button', { name: 'Synchroniser cette saisie', exact: true }).click();
  await page.getByLabel('Code secret de confirmation').fill('1357');
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toContainText(
    'CODE-OFFLINE',
  );
  expect(syncedCode).toBe('1357');
});

test('hors ligne : le PIN déchiffre le coffre après la première connexion', async ({
  page,
  context,
}) => {
  await codeServer(page);
  await firstConnection(page);
  await enterPin(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.getByRole('heading', { name: 'Bon retour', exact: true })).toBeVisible();
  await expect(page.getByLabel('Code secret', { exact: true })).toHaveCount(1);
  await page.getByLabel('Code secret', { exact: true }).fill(initialCode);
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
});

test('code : verrouillage après cinq minutes et saisie effacée', async ({ page }) => {
  await page.clock.install();
  await codeServer(page);
  await firstConnection(page);
  await enterPin(page);
  await page.clock.fastForward(5 * 60 * 1000 + 1000);
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(page.getByLabel('Code secret', { exact: true })).toBeEmpty();
  await expect(page.getByRole('region', { name: 'Bon retour' })).toContainText('5 minutes');
});
