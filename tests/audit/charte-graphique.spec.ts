import { test, expect, type Page } from '@playwright/test';
import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
config({ path: '.env', quiet: true });

// Read-only visual evidence, separate from business regression tests.
test.use({ serviceWorkers: 'block' });
const out = process.env.CHARTER_AUDIT_OUT || 'docs/audits/pwa-mobile-2026-10-23/charte-graphique';
async function measure(page: Page, screen: string) {
  return page.evaluate((screen) => {
    const parse = (s: string) => (s.match(/[\d.]+/g) || []).map(Number);
    const mix = (fg: number[], bg: number[]) => {
      const a = fg[3] ?? 1;
      return fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
    };
    const lum = (c: number[]) =>
      c
        .slice(0, 3)
        .map((v) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a: number[], b: number[]) =>
      (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const visible = (e: Element) => {
      if (e.closest('[hidden]')) return false;
      const b = e.getBoundingClientRect();
      if (!b.width || !b.height || getComputedStyle(e).visibility !== 'visible') return false;
      for (let p = e.parentElement; p; p = p.parentElement) {
        if (
          p.tagName === 'DETAILS' &&
          !p.hasAttribute('open') &&
          !p.querySelector('summary')?.contains(e)
        )
          return false;
      }
      return true;
    };
    const texts = [...document.querySelectorAll('body *')].filter(
      (e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()),
    );
    const rows = texts.map((e) => {
      const s = getComputedStyle(e);
      let opacity = 1,
        gradient = false;
      const chain: Element[] = [];
      for (let p: Element | null = e; p; p = p.parentElement) chain.push(p);
      let bg = [255, 255, 255];
      for (const p of chain.reverse()) {
        const t = getComputedStyle(p);
        opacity *= Number(t.opacity);
        gradient ||= t.backgroundImage !== 'none';
        bg = mix(parse(t.backgroundColor), bg);
      }
      const color = mix(parse(s.color), bg);
      const size = parseFloat(s.fontSize),
        weight = parseFloat(s.fontWeight);
      const disabled = !!e.closest(':disabled,[aria-disabled="true"]');
      const threshold = size >= 24 || (size >= 18.667 && weight >= 700) ? 3 : 4.5;
      return {
        text: e.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120),
        class: e.className,
        tag: e.tagName,
        font: s.fontFamily,
        size,
        weight,
        lineHeight: s.lineHeight,
        color: s.color,
        background: bg.map(Math.round),
        ratio: Math.round(ratio(color, bg) * 100) / 100,
        threshold,
        opacity,
        gradient,
        disabled,
        tabular: s.fontVariantNumeric,
      };
    });
    return {
      screen,
      theme: document.documentElement.dataset.pwaTheme,
      viewport: innerWidth,
      tokens: Object.fromEntries(
        [
          '--green',
          '--action',
          '--surface',
          '--text-primary',
          '--text-secondary',
          '--palette-primary-ink',
          '--palette-primary-solid',
          '--palette-primary-tint',
          '--palette-savings-solid',
          '--palette-tontine-solid',
          '--palette-solidarity-solid',
        ].map((k) => [k, getComputedStyle(document.documentElement).getPropertyValue(k).trim()]),
      ),
      overflow: document.documentElement.scrollWidth - innerWidth,
      fonts: [...document.fonts].map((f) => ({
        family: f.family,
        status: f.status,
        weight: f.weight,
      })),
      sizes: [...new Set(rows.map((r) => r.size))].sort((a, b) => a - b),
      fontResources: performance
        .getEntriesByType('resource')
        .filter((r) => /fonts\.(googleapis|gstatic)/.test(r.name))
        .map((r) => r.name),
      contrastCandidates: rows.filter(
        (r) => r.ratio < r.threshold && !r.disabled && r.opacity === 1 && !r.gradient,
      ),
      rows,
    };
  }, screen);
}
for (const actor of ['admin.ndeye', 'membre.awa'])
  for (const theme of ['light', 'dark'] as const) {
    test(`charte ${actor} ${theme}`, async ({ page }) => {
      test.setTimeout(90000);
      await mkdir(out, { recursive: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript((theme) => localStorage.setItem('alf:pwa:appearance', theme), theme);
      await page.route('**/api/**', (route) => {
        const r = route.request();
        if (
          !['GET', 'HEAD', 'OPTIONS'].includes(r.method()) &&
          !/\/auth\/(login(?:\/secret-code)?|activity|lock)$/.test(new URL(r.url()).pathname)
        )
          return route.fulfill({
            status: 503,
            json: { message: 'Audit : écriture métier bloquée.' },
          });
        return route.continue();
      });
      await page.goto('/');
      await page.getByLabel('Identifiant', { exact: true }).fill(actor);
      await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.DEMO_PASSWORD!);
      await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Déverrouiller avec mon code secret', exact: true }),
      ).toBeVisible();
      await page
        .getByLabel('Code secret', { exact: true })
        .fill(process.env.TEST_SECRET_CODE || '2468');
      await expect(
        page.getByRole('heading', { name: 'Mon groupement', exact: true }),
      ).toBeVisible();
      await expect(page.locator('.pwa-day-card')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const records: unknown[] = [];
      const snap = async (screen: string) => {
        records.push(await measure(page, screen));
        await page.screenshot({ path: `${out}/${actor}-${theme}-${screen}.png`, fullPage: true });
        if (screen === 'accueil')
          await page.screenshot({ path: `${out}/${actor}-${theme}-apercu.png` });
      };
      await snap('accueil');
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      await nav
        .getByRole('button', {
          name: actor === 'admin.ndeye' ? 'Campagnes' : 'Mes campagnes',
          exact: true,
        })
        .click();
      await expect(
        page.locator('.campaign-card-entry,.member-campaign-option').first(),
      ).toBeVisible();
      await snap('campagnes');
      if (actor === 'admin.ndeye') {
        await nav.getByRole('button', { name: 'Membres', exact: true }).click();
        await expect(page.locator('.member-list-card').first()).toBeVisible();
        await snap('membres');
      } else {
        await nav.getByRole('button', { name: 'Mes versements', exact: true }).click();
        await expect(page.locator('.member-history-summary')).not.toContainText('Chargement');
        await snap('historique');
      }
      await writeFile(`${out}/${actor}-${theme}.json`, JSON.stringify(records, null, 2) + '\n');
    });
  }
test('charte : chargement sans fournisseur de polices', async ({ page }) => {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (r) => r.abort());
  await page.goto('/');
  await expect(page.getByLabel('Identifiant', { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await writeFile(
    `${out}/polices-fournisseur-indisponible.json`,
    JSON.stringify(await measure(page, 'connexion-sans-google-fonts'), null, 2) + '\n',
  );
});
