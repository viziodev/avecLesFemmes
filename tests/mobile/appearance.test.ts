import { test, expect, type Page, type Locator } from './fixtures';

test.use({ serviceWorkers: 'block' });
const preferenceKey = 'alf:pwa:appearance';
import { mockSpace, unlockMockSpace } from './pwa-space';

async function openAppearance(page: Page, responsible = false) {
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  if (responsible) {
    await nav.getByRole('button', { name: 'Plus', exact: true }).click();
    await page.getByRole('button', { name: 'Paramètres du groupement', exact: true }).click();
  } else await nav.getByRole('button', { name: 'Mon compte', exact: true }).click();
  return page.getByRole('region', { name: 'Apparence', exact: true });
}

async function expectTheme(page: Page, theme: 'light' | 'dark') {
  await expect(page.locator('html')).toHaveAttribute('data-pwa-theme', theme);
  await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    theme === 'dark' ? '#101a16' : '#f6f8f7',
  );
}

async function readableText(locator: Locator) {
  const styles = await locator.evaluate((el) => {
    let parent: Element | null = el;
    let bg = 'rgba(0, 0, 0, 0)';
    while (parent && bg === 'rgba(0, 0, 0, 0)') {
      bg = getComputedStyle(parent).backgroundColor;
      parent = parent.parentElement;
    }
    return {
      fg: getComputedStyle(el).color,
      bg,
    };
  });
  const luminance = (rgb: string) => {
    const channels = rgb
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(styles.fg), luminance(styles.bg)].sort((a, b) => a - b);
  expect((values[1] + 0.05) / (values[0] + 0.05), JSON.stringify(styles)).toBeGreaterThanOrEqual(
    4.5,
  );
}

test('membre : automatique, choix explicite persistant et synchronisation entre onglets', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockSpace(page);
  await page.goto('/');
  await unlockMockSpace(page);
  const settings = await openAppearance(page);
  await expect(settings.getByRole('radio', { name: 'Automatique', exact: true })).toBeChecked();
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');
  await settings.getByText('Sombre', { exact: true }).click();
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await settings.getByText('Clair', { exact: true }).click();
  await expectTheme(page, 'light');
  await page.reload();
  await unlockMockSpace(page);
  await expectTheme(page, 'light');
  await openAppearance(page);
  await expect(settings.getByRole('radio', { name: 'Clair', exact: true })).toBeChecked();
  expect(await page.evaluate((key) => localStorage.getItem(key), preferenceKey)).toBe('light');
  const other = await context.newPage();
  await mockSpace(other);
  await other.goto('/');
  await unlockMockSpace(other);
  await expectTheme(other, 'light');
  const otherSettings = await openAppearance(other);
  await otherSettings.getByText('Sombre', { exact: true }).click();
  await expectTheme(page, 'dark');
  await other.close();
  await unlockMockSpace(page);
  await openAppearance(page);
  await settings.getByText('Automatique', { exact: true }).click();
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');
});

test('membre sombre : campagnes, formulaires, navigation et QR lisibles', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockSpace(page);
  await page.goto('/');
  await unlockMockSpace(page);
  await expect(page.locator('.pwa-day-total')).toBeVisible();
  await readableText(page.locator('.pwa-day-total > strong'));
  await readableText(page.locator('.member-payment-list h2'));
  await readableText(page.locator('.member-payment-card .compact-card-line').first());
  const qr = page.getByRole('button', { name: 'Présenter mon QR', exact: true });
  await qr.click();
  await expect(page.locator('.qr-box')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.qr-box svg path[stroke="#000000"]')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByRole('button', { name: /^Faire un versement/ }).click();
  const form = page.getByRole('dialog', { name: 'Faire un versement', exact: true });
  await readableText(form.getByLabel('Montant à verser (FCFA)', { exact: true }));
  await expect(form).toHaveCSS('background-color', 'rgb(24, 38, 32)');
  await form.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page
    .getByRole('button', { name: 'Choisir la campagne Tontine des projets', exact: true })
    .click();
  await readableText(page.locator('.pwa-day-metrics strong').first());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('membre-sombre.png'), fullPage: true });
});

test('responsable : mêmes réglages, navigation et fenêtre de campagne en sombre', async ({
  page,
}) => {
  await mockSpace(page, true);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await unlockMockSpace(page);
  const settings = await openAppearance(page, true);
  await settings.getByText('Sombre', { exact: true }).click();
  await expectTheme(page, 'dark');
  await readableText(settings.getByRole('status'));
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(page.locator('.campaign-card-entry').first()).toBeVisible();
  await readableText(page.locator('.campaign-card-entry .compact-card-line').first());
  await page.getByRole('button', { name: 'Créer une campagne', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(24, 38, 32)');
  await readableText(page.getByRole('dialog').getByRole('heading').first());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('responsable-sombre.png'), fullPage: true });
});

test('préférence invalide ou stockage bloqué : automatique et choix utilisable pendant la visite', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'invalid');
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  }, preferenceKey);
  await mockSpace(page);
  await page.goto('/');
  await unlockMockSpace(page);
  await expectTheme(page, 'dark');
  const settings = await openAppearance(page);
  await expect(settings.getByRole('radio', { name: 'Automatique', exact: true })).toBeChecked();
  await settings.getByText('Clair', { exact: true }).click();
  await expectTheme(page, 'light');
  await expect(settings.getByRole('status')).toContainText(
    'Le navigateur empêche son enregistrement',
  );
});
