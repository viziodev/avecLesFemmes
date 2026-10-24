import { loginPwa } from './fixtures';
import { test, expect } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });

// Device emulation on Chromium/WebKit; this is not a physical-device test.
for (const login of ['admin.ndeye', 'membre.awa']) {
  test(`${login} : navigation tactile, confidentialité et dialogue`, async ({ page }) => {
    if (!process.env.DEMO_PASSWORD)
      throw new Error('DEMO_PASSWORD requis pour les comptes locaux.');
    await page.goto('/');
    await loginPwa(page, login);
    await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const button of await nav.getByRole('button').all()) {
      const bounds = await button.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
    }
    if (login === 'admin.ndeye') {
      await page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('button', { name: 'Plus', exact: true })
        .click();
      await page.getByRole('button', { name: 'Mon épargne personnelle', exact: true }).tap();
      await expect(
        page.getByRole('region', { name: 'Identité du groupement et du membre', exact: true }),
      ).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Encaisser', exact: true })).toHaveCount(0);
    }
    await nav.getByRole('button', { name: 'Mes versements', exact: true }).tap();
    await expect(
      page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }),
    ).toHaveCount(0);
    await nav.getByRole('button', { name: 'Accueil', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Mon Code QR', exact: true })).toHaveCount(0);
    const dialog = page.getByRole('dialog');
    const personalQr = page.getByRole('button', { name: 'Présenter mon QR', exact: true });
    await personalQr.tap();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).first().tap();
    await expect(dialog).toHaveCount(0);
    await expect(personalQr).toBeFocused();
    await page.screenshot({ path: test.info().outputPath('mobile-accueil.png'), fullPage: true });
  });
}
