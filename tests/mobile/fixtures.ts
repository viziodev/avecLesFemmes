import { test as base, expect } from '@playwright/test';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
export { expect };
export const testCode = process.env.TEST_SECRET_CODE || '2468';
export type { Page, Locator } from '@playwright/test';
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
