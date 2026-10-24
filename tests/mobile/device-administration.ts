import { expect, type Page } from './fixtures';

export async function forgetDeviceAsSuperAdmin(page: Page, password: string) {
  await page.goto('/?administration-appareil');
  await page.getByLabel('Identifiant Super Admin', { exact: true }).fill('superadmin');
  await page.getByLabel('Mot de passe Super Admin', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Confirmer l’oubli de cet appareil', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Appareil révoqué et compte oublié');
  await page.getByRole('link', { name: 'Retour à la connexion', exact: true }).click();
}
