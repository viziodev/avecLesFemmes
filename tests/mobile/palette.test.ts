import { test, expect } from './fixtures';
import { contrast, defaultPalette, paletteStyle } from '../../packages/ui/src/Palette';
import { mockSpace, unlockMockSpace } from './pwa-space';

test.use({ serviceWorkers: 'block' });

test('palette commune appliquée à l’accueil et aux campagnes en clair et sombre', async ({
  page,
}) => {
  await mockSpace(page);
  await page.route('**/appearance', (route) =>
    route.fulfill({
      json: { primary: '#0044cc', savings: '#aabb00', tontine: '#dd5577', solidarity: '#33ccaa' },
    }),
  );
  await page.goto('/');
  await unlockMockSpace(page);
  const identity = page.locator('.pwa-compact-identity');
  await expect(identity).toBeVisible();
  const primary = await identity.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(primary).toBe('rgb(0, 68, 204)');
  const ink = await page
    .locator('.pwa-day-card')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--campaign-color').trim());
  expect(ink).not.toBe('');
  await page.evaluate(() => {
    localStorage.setItem('alf:pwa:appearance', 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: 'alf:pwa:appearance' }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-pwa-theme', 'dark');
  await expect(identity).toHaveCSS('background-color', primary);
  const darkInk = await page
    .locator('.pwa-day-card')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--campaign-color').trim());
  expect(darkInk).not.toEqual(ink);
  await page.screenshot({ path: test.info().outputPath('palette-sombre.png'), fullPage: true });
});

test('couleurs très claires ou sombres : contraste lisible pour boutons, textes et fonds', () => {
  for (const color of [
    '#ffffff',
    '#000000',
    '#ffff00',
    '#00ffff',
    '#ff0000',
    ...Object.values(defaultPalette),
  ]) {
    for (const dark of [false, true]) {
      const vars = paletteStyle(
        { primary: color, savings: color, tontine: color, solidarity: color },
        dark,
      ) as Record<string, string>;
      for (const key of Object.keys(defaultPalette)) {
        expect(contrast(vars[`--palette-${key}-solid`], '#ffffff')).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(vars[`--palette-${key}-ink`], vars[`--palette-${key}-tint`]),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(vars[`--palette-${key}-ink`], dark ? '#21382e' : '#f4f7f5'),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

test('Super Admin : aperçu, erreur conservant la saisie, enregistrement et retour aux valeurs par défaut', async ({
  page,
}) => {
  await mockSpace(page);
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: { id: 'super', name: 'Super Admin', login: 'superadmin', isSuper: true },
    }),
  );
  let palette = { ...defaultPalette };
  let writes = 0;
  await page.route('**/api/v1/appearance', async (route) => {
    if (route.request().method() === 'PUT') {
      writes++;
      if (writes === 1) return route.fulfill({ status: 503, json: { message: 'Indisponible' } });
      palette = route.request().postDataJSON();
    }
    return route.fulfill({ json: palette });
  });
  await page.goto(process.env.WEB_URL || 'http://localhost:8085/');
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Apparence', exact: true })
    .click();
  const section = page.getByRole('region', { name: 'Couleurs de l’application' });
  const input = section.getByLabel('Couleur principale', { exact: true });
  await expect(input).toHaveValue(defaultPalette.primary);
  await input.fill('#0044cc');
  const preview = page
    .getByRole('region', { name: 'Aperçu clair' })
    .locator('.palette-preview-header');
  await expect(preview).toHaveCSS('background-color', 'rgb(0, 68, 204)');
  expect(writes).toBe(0);
  await section.getByRole('button', { name: 'Enregistrer les couleurs', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('Enregistrement impossible');
  await expect(input).toHaveValue('#0044cc');
  await section.getByRole('button', { name: 'Enregistrer les couleurs', exact: true }).click();
  await expect(section.getByRole('status')).toContainText('Couleurs enregistrées');
  expect(palette.primary).toBe('#0044cc');
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Apparence', exact: true })
    .click();
  await expect(input).toHaveValue('#0044cc');
  await section.getByRole('button', { name: 'Rétablir les couleurs par défaut' }).click();
  expect(palette.primary).toBe('#0044cc');
  await section.getByRole('button', { name: 'Enregistrer les couleurs', exact: true }).click();
  await expect(section.getByRole('status')).toContainText('Couleurs enregistrées');
  expect(palette).toEqual(defaultPalette);
});
