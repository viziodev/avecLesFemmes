import { test as base, expect } from '@playwright/test';
import { config } from 'dotenv';
import { demoPin } from '../../apps/api/src/auth/password';
config({ path: '.env', quiet: true });
export { expect };
export const testCode =
  process.env.TEST_SECRET_CODE || demoPin(process.env.DEMO_PASSWORD || 'Test-password-only');
export type { Page, Locator } from '@playwright/test';
export async function prepareOfflineForTest(
  page: import('@playwright/test').Page,
  password = process.env.DEMO_PASSWORD || 'Test-password-only',
) {
  const prepare = page.getByRole('button', { name: 'Activer l’accès hors ligne', exact: true });
  if (!(await prepare.isVisible())) return;
  await prepare.click();
  const dialog = page.getByRole('dialog', { name: 'Préparer le mode hors ligne', exact: true });
  await dialog.getByLabel('Mot de passe personnel', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Activer le coffre', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
export async function loginPwa(
  page: import('@playwright/test').Page,
  identity = 'membre.awa',
  options: { pin?: string; password?: string; prepareOffline?: boolean } = {},
) {
  const phones: Record<string, string> = {
    'membre.awa': '+221770000003',
    'admin.ndeye': '+221770000002',
    'mock.user': '+221770000003',
  };
  const phone = phones[identity] || identity;
  const phoneField = page.getByLabel('Numéro de téléphone', { exact: true });
  await expect(phoneField.or(page.getByLabel('Code secret', { exact: true }))).toBeVisible();
  if (await phoneField.isVisible()) {
    await phoneField.fill(phone);
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  }
  await page.getByLabel('Code secret', { exact: true }).fill(options.pin || testCode);
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  if (options.prepareOffline !== false) await prepareOfflineForTest(page, options.password);
}
export async function unlockReturning(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { name: 'Bon retour', exact: true })).toBeVisible();
  const code = page.getByLabel('Code secret', { exact: true });
  if (await code.isVisible()) await code.fill(testCode);
  else {
    await page
      .getByLabel('Mot de passe', { exact: true })
      .fill(process.env.DEMO_PASSWORD || 'Test-password-only');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
}
export const test = base.extend<{ autoConfirmSensitive: boolean; autoSetupSecretCode: boolean }>({
  autoConfirmSensitive: [true, { option: true }],
  autoSetupSecretCode: [true, { option: true }],
  page: async ({ page, autoConfirmSensitive, autoSetupSecretCode }, use) => {
    if (autoSetupSecretCode)
      await page.addLocatorHandler(
        page.getByRole('heading', {
          level: 1,
          name: /^(Choisissez votre code secret|Confirmez votre code secret|Déverrouiller avec mon code secret)$/,
        }),
        async (heading) => {
          const first = (await heading.innerText()) === 'Choisissez votre code secret';
          await page.getByLabel('Code secret', { exact: true }).fill(testCode);
          if (first) {
            await expect(
              page.getByRole('heading', { name: 'Confirmez votre code secret', exact: true }),
            ).toBeVisible();
            await page.getByLabel('Code secret', { exact: true }).fill(testCode);
          }
        },
      );
    // Existing business regressions still exercise the password confirmation.
    // Dedicated security tests disable this helper to assert every step.
    if (autoConfirmSensitive)
      await page.addLocatorHandler(
        page.getByRole('dialog', { name: /^Confirmer avec mon (mot de passe|code secret)$/ }),
        async (dialog) => {
          const code = dialog.getByLabel('Code secret de confirmation', { exact: true });
          if (await code.isVisible()) {
            await code.fill(testCode);
            return;
          }
          await dialog
            .getByLabel('Mot de passe de confirmation')
            .fill(process.env.DEMO_PASSWORD || 'Test-password-only');
          await dialog.getByRole('button', { name: 'Confirmer l’opération', exact: true }).click();
        },
      );
    await use(page);
  },
});
