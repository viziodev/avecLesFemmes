import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('comparatif de charte : profils, thèmes, types et largeur mobile', async ({ page }) => {
  const out = resolve('docs/audits/pwa-mobile-2026-10-23/charte-graphique');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1120, height: 1000 });
  await page.goto(pathToFileURL(`${out}/PROPOSITION-CHARTE.html`).href);
  for (const profile of ['admin.ndeye', 'membre.awa']) {
    await page.getByRole('combobox', { name: 'Profil', exact: true }).selectOption(profile);
    for (const theme of ['Clair', 'Sombre']) {
      await page.getByRole('button', { name: theme, exact: true }).click();
      for (const type of ['savings', 'tontine', 'solidarity']) {
        await page
          .getByRole('combobox', { name: 'Type dans la proposition', exact: true })
          .selectOption(type);
        await expect(page.locator('#phone')).toHaveAttribute('data-type', type);
        await expect(page.locator('#person')).toContainText(
          profile === 'admin.ndeye' ? 'Ndèye' : 'Awa',
        );
        await expect
          .poll(() =>
            page
              .locator('#current')
              .evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
          )
          .toBe(true);
      }
    }
  }
  await page.getByRole('combobox', { name: 'Profil', exact: true }).selectOption('admin.ndeye');
  await page
    .getByRole('combobox', { name: 'Type dans la proposition', exact: true })
    .selectOption('savings');
  await page.getByRole('button', { name: 'Clair', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/comparatif-charte-clair.png`, fullPage: true });
  await page.locator('#phone').screenshot({ path: `${out}/proposition-responsable-clair.png` });
  await page.getByRole('combobox', { name: 'Profil', exact: true }).selectOption('membre.awa');
  await page.getByRole('button', { name: 'Sombre', exact: true }).click();
  await page.locator('#phone').screenshot({ path: `${out}/proposition-membre-sombre.png` });
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await expect(page.locator('#action')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
