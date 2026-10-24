import { test, expect } from './fixtures';
import { mockSpace, unlockMockSpace } from './pwa-space';

test.use({ serviceWorkers: 'block' });
test('historique : dates lisibles sans débordement et bornes transmises au serveur', async ({
  page,
}) => {
  await mockSpace(page, true);
  await page.goto('/');
  await unlockMockSpace(page);
  await page.getByRole('button', { name: 'Historique des cotisations', exact: true }).click();
  const start = page.getByLabel('Du', { exact: true });
  const end = page.getByLabel('Au', { exact: true });
  await expect(start).toBeVisible();
  for (const width of [320, 375, 390, 498]) {
    await page.setViewportSize({ width, height: 844 });
    for (const input of [start, end]) {
      const rect = await input.boundingBox();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      expect(rect!.height).toBeGreaterThanOrEqual(44);
    }
    const a = (await start.boundingBox())!,
      b = (await end.boundingBox())!;
    expect(a.y + a.height <= b.y || a.x + a.width < b.x).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const filtered = page.waitForRequest((r) => {
    const url = new URL(r.url());
    return (
      url.pathname.endsWith('/contributions') &&
      url.searchParams.get('from') === '2026-10-01' &&
      url.searchParams.get('to') === '2026-10-24'
    );
  });
  await start.fill('2026-10-01');
  await end.fill('2026-10-24');
  await filtered;
  await expect(start).toHaveAttribute('max', '2026-10-24');
  await expect(end).toHaveAttribute('min', '2026-10-01');
  await page.setViewportSize({ width: 375, height: 844 });
  await page.screenshot({
    path: test.info().outputPath('historique-dates-mobile.png'),
    fullPage: true,
  });
  const cleared = page.waitForRequest((r) => {
    const url = new URL(r.url());
    return (
      url.pathname.endsWith('/contributions') &&
      !url.searchParams.has('from') &&
      !url.searchParams.has('to')
    );
  });
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click();
  await cleared;
  await expect(start).toBeEmpty();
  await expect(end).toBeEmpty();
});
