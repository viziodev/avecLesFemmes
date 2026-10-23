import { test, expect } from './fixtures';
import {
  contrast,
  defaultPalette,
  paletteStyle,
  similarCampaignColors,
} from '../../packages/ui/src/Palette';
import { mockSpace, unlockMockSpace } from './pwa-space';
test.use({ serviceWorkers: 'block' });

for (const responsible of [true, false]) {
  test(`charte ${responsible ? 'responsable' : 'membre'} : texte, contraste rendu et agrandissement`, async ({
    page,
  }) => {
    await mockSpace(page, responsible);
    await page.route('**/appearance', (r) => r.fulfill({ json: defaultPalette }));
    const external: string[] = [];
    page.on('request', (r) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
    });
    await page.goto('/');
    await unlockMockSpace(page);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        localStorage.setItem('alf:pwa:appearance', theme);
        dispatchEvent(new StorageEvent('storage', { key: 'alf:pwa:appearance' }));
      }, theme);
      const active = page.locator('.nav-item.active');
      const pair = await active.evaluate((e) => {
        const s = getComputedStyle(e);
        const hex = (v: string) =>
          '#' +
          v
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map((n) => Number(n).toString(16).padStart(2, '0'))
            .join('');
        return { fg: hex(s.color), bg: hex(s.backgroundColor) };
      });
      expect(contrast(pair.fg, pair.bg)).toBeGreaterThanOrEqual(4.5);
      await expect(page.locator('.nav-label-mobile').first()).toHaveCSS('font-size', '12px');
      await expect(page.locator('.pwa-day-heading p')).toHaveCSS('font-size', '14px');
      await expect(page.locator('.pwa-day-heading h2')).toHaveCSS('font-family', /DM Sans/);
      await expect(page.locator('.pwa-day-metrics strong,.pwa-day-total strong').first()).toHaveCSS(
        'font-variant-numeric',
        'tabular-nums',
      );
      for (const width of [360, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(
          0,
        );
      }
    }
    await page.addStyleTag({ content: ':root[data-pwa-theme] { font-size: 200% !important; }' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.pwa-day-heading h2')).toHaveCSS('font-size', '40px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    expect(external).toEqual([]);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.fonts.load('600 16px "DM Sans"', 'Épargne Ñëw Ŋŋ'));
    expect(
      await page.evaluate(() => document.fonts.check('600 16px "DM Sans"', 'Épargne Ñëw Ŋŋ')),
    ).toBe(true);
  });
}

test('palettes extrêmes : contraste sur toutes les surfaces de la charte et distinction des types', () => {
  for (const color of [
    '#ffffff',
    '#000000',
    '#ffff00',
    '#00ffff',
    '#ff0000',
    ...Object.values(defaultPalette),
  ]) {
    for (const dark of [true, false]) {
      const vars = paletteStyle(
        { primary: color, savings: color, tontine: color, solidarity: color },
        dark,
      ) as Record<string, string>;
      const backgrounds = dark
        ? ['#101a16', '#182620', '#21362c', '#193e31']
        : ['#ffffff', '#f6f8f7', '#edf3ef'];
      for (const key of Object.keys(defaultPalette)) {
        for (const bg of [...backgrounds, vars[`--palette-${key}-tint`]])
          expect(contrast(vars[`--palette-${key}-ink`], bg)).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(
          vars['--navigation-selected-foreground'],
          vars['--navigation-selected-background'],
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(similarCampaignColors(defaultPalette)).toEqual([]);
  expect(similarCampaignColors({ ...defaultPalette, tontine: defaultPalette.savings })).toContain(
    'Épargne et Tontine',
  );
});

test.describe('polices hors ligne', () => {
  test.use({ serviceWorkers: 'allow' });
  test('démarrage avec les polices françaises et wolof après installation', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const fonts = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const urls = (
        await Promise.all(
          cacheNames.map(async (name) =>
            (await (await caches.open(name)).keys()).map((r) => r.url),
          ),
        )
      ).flat();
      return urls.filter((u) => /dm-sans.*\.woff2/.test(u));
    });
    expect(fonts).toHaveLength(2);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Identifiant', { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.load('600 16px "DM Sans"', 'Épargne Ñëw Ŋŋ'));
    expect(
      await page.evaluate(() => document.fonts.check('600 16px "DM Sans"', 'Épargne Ñëw Ŋŋ')),
    ).toBe(true);
    await context.setOffline(false);
  });
});
