import { loginPwa } from './fixtures';
import { test, expect, unlockReturning } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'allow' });

test('PWA installée : réouverture réellement hors ligne et déverrouillage du cache chiffré', async ({
  page,
  context,
}) => {
  if (!process.env.DEMO_PASSWORD) throw new Error('DEMO_PASSWORD requis.');
  await page.goto('/');
  await loginPwa(page, 'membre.awa');
  await expect(
    page.getByRole('region', { name: 'Identité du groupement et du membre' }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(page.locator('.pwa-day-card')).toHaveCount(0);
  await unlockReturning(page);
  await expect(
    page.getByRole('region', { name: 'Identité du groupement et du membre' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'État de connexion et synchronisation' }),
  ).toContainText('Hors connexion');
});
