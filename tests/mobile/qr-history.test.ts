import { loginPwa } from './fixtures';
import { test, expect } from './fixtures';
import QRCode from 'qrcode';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });
test('scan QR image, membre présélectionnée et historique groupé', async ({ page }) => {
  await page.route('**/savings-session', (route) =>
    route.fulfill({
      json: { today: '2026-10-19', scheduled: true, opened: true, can_collect: true },
    }),
  );
  await page.route('**/contributions?*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'qr-history-test',
            name: 'Ndèye Diop',
            phone: '+221770000002',
            amount: '2000',
            paid_on: '2026-10-19',
            created_at: '2026-10-19T10:00:00Z',
            reference: 'QR-HISTORY-TEST',
            voided_at: null,
          },
        ],
        total: 1,
      },
    }),
  );
  await page.goto('/');
  await loginPwa(page, 'admin.ndeye');
  const scan = page.getByRole('button', { name: 'Scanner le QR d’une membre' });
  await expect(scan).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Plus', exact: true })
    .click();
  await page.getByRole('button', { name: 'Ma carte de membre', exact: true }).click();
  const content = await page.getByRole('dialog').innerText();
  const code = content.match(/ALF:MEMBER:[^\s]+/)![0];
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fermer', exact: true })
    .first()
    .click();
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Accueil', exact: true })
    .click();
  await scan.click();
  await page.getByLabel('Choisir une image du QR').setInputFiles({
    name: 'membre.png',
    mimeType: 'image/png',
    buffer: await QRCode.toBuffer(code, { width: 500 }),
  });
  await expect(page.getByRole('dialog')).toContainText('Enregistrer une cotisation');
  await expect(
    page.getByRole('dialog').locator('select[name="participationId"] option:checked'),
  ).toContainText('Diop');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Fermer', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Historique des cotisations', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Historique des encaissements' })).toBeVisible();
  await expect(page.locator('.history-day').first()).toBeVisible();
  await page.getByLabel('État des encaissements').selectOption('valid');
  await expect(page.locator('.history-day li').first()).toBeVisible();
  await expect(page.locator('.history-voided')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('historique.png') });
});
