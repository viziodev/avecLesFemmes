import { test, expect, type Page } from '@playwright/test';
import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { chooseCampaign } from '../mobile/campaign-choice';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });
const out = 'docs/audits/pwa-mobile-2026-10-22';
// Audit evidence, not a conformance certificate. Never submit a business mutation.
async function readOnly(page: Page) {
  await page.route('**/api/**', (route) => {
    const r = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && !r.url().endsWith('/auth/login'))
      return route.fulfill({
        status: 503,
        json: { message: 'Audit : écriture métier interdite.' },
      });
    return route.continue();
  });
}
async function login(page: Page, name: string) {
  if (!process.env.DEMO_PASSWORD) throw new Error('DEMO_PASSWORD requis.');
  await page.goto('/');
  await page.getByRole('button', { name: 'Identifiant', exact: true }).click();
  await page.getByLabel('Identifiant', { exact: true }).fill(name);
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  await expect(
    page.locator('.wave-actions-grid .overview-campaign-shortcut').first(),
  ).toBeVisible();
}
async function measure(page: Page, screen: string) {
  return page.evaluate((screen) => {
    const visible = (e: Element) => {
      for (let ancestor = e.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (
          ancestor.tagName === 'DETAILS' &&
          !ancestor.hasAttribute('open') &&
          !ancestor.querySelector('summary')?.contains(e)
        )
          return false;
      }
      const b = e.getBoundingClientRect(),
        s = getComputedStyle(e);
      return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const rect = (e: Element | null) => {
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return {
        top: Math.round(b.top + scrollY),
        width: Math.round(b.width),
        height: Math.round(b.height),
      };
    };
    const label = (e: Element) =>
      (
        e.getAttribute('aria-label') ||
        e.getAttribute('title') ||
        (e as HTMLInputElement).labels?.[0]?.textContent ||
        e.textContent ||
        ''
      )
        .trim()
        .slice(0, 100);
    const controls = [
      ...document.querySelectorAll('button,input,select,textarea,summary,a[href]'),
    ].filter(visible);
    return {
      screen,
      width: innerWidth,
      viewportHeight: innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
      h1: document.querySelector('h1')?.textContent,
      historyLength: history.length,
      url: location.pathname + location.search + location.hash,
      hero: rect(document.querySelector('.member-identity-hero')),
      cta: rect(document.querySelector('.wave-giant-cta-wrapper')),
      nav: rect(document.querySelector('nav[aria-label="Navigation principale"]')),
      controlsUnder44: controls
        .filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width < 44 || b.height < 44;
        })
        .map((e) => ({ tag: e.tagName, label: label(e), rect: rect(e) })),
      unnamedInputs: controls
        .filter(
          (e) =>
            e.matches('input,select,textarea') && !label(e) && !e.hasAttribute('aria-labelledby'),
        )
        .map((e) => ({ type: e.getAttribute('type'), rect: rect(e) })),
      clippedText: [
        ...document.querySelectorAll(
          '.compact-card-line,.campaign-short-name,.member-identity-name',
        ),
      ]
        .filter(visible)
        .filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)
        .map((e) => ({
          text: e.textContent?.trim(),
          title: e.getAttribute('title'),
          rect: rect(e),
        })),
      alerts: [...document.querySelectorAll('[role="alert"]')]
        .filter(visible)
        .map((e) => e.textContent?.trim()),
      group: document.querySelector('.pwa-group-identity')?.textContent,
    };
  }, screen);
}
async function evidence(name: string, value: unknown) {
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/${name}.json`, JSON.stringify(value, null, 2) + '\n');
}
for (const actor of ['admin.ndeye', 'membre.awa']) {
  test(`audit lecture seule : ${actor}, trois largeurs et interfaces`, async ({ page }, info) => {
    test.setTimeout(90000);
    await readOnly(page);
    await login(page, actor);
    const records: unknown[] = [];
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    const snap = async (screen: string, width: number) => {
      records.push(await measure(page, screen));
      if (width === 390 && info.project.name === 'android-chromium')
        await page.screenshot({ path: `${out}/${actor}-${screen}-390.png`, fullPage: false });
    };
    await mkdir(out, { recursive: true });
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({
        width,
        height: width === 360 ? 800 : width === 390 ? 844 : 932,
      });
      await nav.getByRole('button', { name: 'Accueil', exact: true }).click();
      await snap('accueil', width);
      const plus = page.getByRole('button', { name: 'Plus de campagnes', exact: true });
      if (await plus.count()) {
        await plus.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await snap('plus', width);
        await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
      }
      if (actor === 'admin.ndeye') {
        await page.getByRole('button', { name: 'Paramètres du groupement', exact: true }).click();
        await snap('parametres', width);
        await page.getByRole('button', { name: 'Retour', exact: true }).click();
        await nav.getByRole('button', { name: 'Campagnes', exact: true }).click();
        await expect(page.locator('.campaign-card-entry').first()).toBeVisible();
        await snap('campagnes', width);
        await page.getByRole('button', { name: 'Créer une campagne', exact: true }).click();
        await snap('formulaire-campagne', width);
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Fermer', exact: true })
          .first()
          .click();
        await nav.getByRole('button', { name: 'Membres', exact: true }).click();
        await expect(page.locator('.member-list-card').first()).toBeVisible();
        await snap('membres', width);
        await nav.getByRole('button', { name: 'Accueil', exact: true }).click();
        await page.getByRole('button', { name: 'Historique des cotisations', exact: true }).click();
        await expect(
          page.getByRole('region', { name: 'Historique des encaissements', exact: true }),
        ).toBeVisible();
        await snap('historique', width);
      } else {
        await nav.getByRole('button', { name: 'Mes campagnes', exact: true }).click();
        await snap('campagnes', width);
        await page.getByRole('button', { name: 'Choisir mes campagnes', exact: true }).click();
        await snap('personnalisation', width);
        await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
        await nav.getByRole('button', { name: 'Mes versements', exact: true }).click();
        await expect(page.locator('.member-history-summary')).not.toContainText('Chargement');
        await snap('historique', width);
        await page.locator('.member-history-filters > summary').click();
        await snap('filtres', width);
        await nav.getByRole('button', { name: 'Mon compte', exact: true }).click();
        await snap('compte', width);
      }
    }
    await evidence(`${actor}-${info.project.name}`, records);
  });
}

test('audit : pagination après échec réseau dans Mes versements', async ({ page }, info) => {
  await readOnly(page);
  const pages: number[] = [];
  const rows = Array.from({ length: 12 }, (_, i) => ({
    id: `audit-${i}`,
    participation_id: 'audit',
    name: 'Membre audit',
    amount: '1000',
    paid_on: '2026-10-21',
    reference: `AUDIT-${i}`,
    voided_at: null,
    campaign_id: 'audit',
    campaign_name: 'Épargne audit',
    campaign_active: true,
    type_id: 'audit',
    type_name: 'Avec Épargne',
    type_code: 'AVEC',
    session_date: '2026-10-21',
    round_number: null,
  }));
  await page.route('**/member/history?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'));
    pages.push(p);
    return p === 2
      ? route.fulfill({ status: 503, json: { message: 'Audit : coupure simulée page 2.' } })
      : route.fulfill({
          json: { items: rows.slice((p - 1) * 5, p * 5), total: 12, total_paid: '12000' },
        });
  });
  await login(page, 'membre.awa');
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Mes versements', exact: true })
    .click();
  const cards = page.locator('.member-history-results .member-payment-card');
  await expect(cards).toHaveCount(5);
  await page.getByRole('button', { name: 'Voir plus de versements', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('coupure simulée');
  await page.getByRole('button', { name: 'Voir plus de versements', exact: true }).click();
  await expect(cards).toHaveCount(7);
  await evidence(`pagination-${info.project.name}`, {
    requestedPages: pages,
    visibleCards: await cards.count(),
    references: await cards.locator('.member-payment-reference').allTextContents(),
    expectedComplete: 12,
  });
});

test('audit : erreurs de cahier présentées comme absence de séance', async ({ page }, info) => {
  await readOnly(page);
  await page.route('**/campaigns/*/sessions', (r) =>
    r.fulfill({ status: 503, json: { message: 'Audit : cahiers indisponibles.' } }),
  );
  await login(page, 'admin.ndeye');
  await chooseCampaign(page, 'Épargne solidaire 2026');
  await expect(
    page.getByRole('region', { name: 'Cahiers de séance d’épargne', exact: true }),
  ).toContainText('Aucune séance enregistrée.');
  await evidence(`erreur-seances-${info.project.name}`, {
    emptyMessage: await page
      .getByRole('region', { name: 'Cahiers de séance d’épargne', exact: true })
      .innerText(),
    alerts: await page.getByRole('alert').allTextContents(),
  });
  if (info.project.name === 'android-chromium')
    await page.screenshot({ path: `${out}/erreur-seances.png`, fullPage: true });
});

test('audit : bouton de versement personnel hors connexion', async ({ page, context }, info) => {
  await readOnly(page);
  await page.route('**/member/campaigns/*', (r) =>
    r.request().url().endsWith('/shortcuts')
      ? r.continue()
      : r.fulfill({
          json: {
            today: '2026-10-22',
            can_pay: true,
            already_paid: false,
            reason: 'Séance ouverte pour cet audit.',
            total_paid: '1000',
            sessions: [],
            rounds: [],
            payouts_count: 0,
            remaining_months: 0,
          },
        }),
  );
  await login(page, 'membre.awa');
  const pay = page.getByRole('button', { name: /^Faire un versement/ });
  await expect(pay).toBeEnabled();
  await context.setOffline(true);
  await expect(page.getByText('Hors connexion', { exact: true })).toBeVisible();
  await evidence(`hors-ligne-${info.project.name}`, {
    payEnabled: await pay.isEnabled(),
    banner: await page.locator('.offline-banner, .alert, [role="status"]').allTextContents(),
  });
  await context.setOffline(false);
});

test('audit : paramètres, contraste, nom accessible et Retour navigateur', async ({
  page,
}, info) => {
  await readOnly(page);
  await login(page, 'admin.ndeye');
  await page.getByRole('button', { name: 'Paramètres du groupement', exact: true }).click();
  const settings = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('.wave-switch input')!;
    const hint = document.querySelector('.wave-settings-hint')!;
    const style = getComputedStyle(hint);
    let bg = '';
    for (let e: Element | null = hint; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
        bg = c;
        break;
      }
    }
    return {
      switch: {
        ariaLabel: input.getAttribute('aria-label'),
        ariaLabelledby: input.getAttribute('aria-labelledby'),
        labels: [...(input.labels || [])].map((l) => l.textContent?.trim()),
        opacity: getComputedStyle(input).opacity,
      },
      hint: { color: style.color, background: bg, fontSize: style.fontSize },
      staticStatus: [...document.querySelectorAll('.wave-settings-row')]
        .map((e) => e.textContent?.trim())
        .filter((t) => /Conforme|Actif/.test(t || '')),
      support: document
        .querySelector('.wave-settings-screen a[href^="tel:"]')
        ?.getAttribute('href'),
    };
  });
  const stackBefore = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Membres', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Les membres', exact: true })).toBeVisible();
  const stackAfter = await page.evaluate(() => history.length);
  await page.goBack();
  await evidence(`navigation-parametres-${info.project.name}`, {
    settings,
    stackBefore,
    stackAfter,
    urlAfterBack: page.url(),
  });
});

for (const actor of ['admin.ndeye', 'membre.awa']) {
  test(`audit lecture seule : séances et tontine, ${actor}`, async ({ page }, info) => {
    await readOnly(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, actor);
    const records: unknown[] = [];
    if (actor === 'admin.ndeye') {
      await chooseCampaign(page, 'Épargne solidaire 2026');
      const sessions = page.getByRole('region', {
        name: 'Cahiers de séance d’épargne',
        exact: true,
      });
      await expect(sessions).toBeVisible();
      const first = sessions.locator('summary').first();
      if (await first.count()) await first.click();
      records.push(await measure(page, 'seance-ouverte'));
      if (info.project.name === 'android-chromium')
        await page.screenshot({ path: `${out}/admin-seances-390.png`, fullPage: true });
    }
    await chooseCampaign(page, 'Tontine TEST Suivi · 2026-10-21');
    const region = page.getByRole('region', {
      name: actor === 'admin.ndeye' ? 'Tours de tontine' : 'Suivi de la tontine',
      exact: true,
    });
    await expect(region).toBeVisible();
    if (actor === 'admin.ndeye') {
      const first = region.locator('summary').first();
      if (await first.count()) await first.click();
    }
    records.push(await measure(page, 'tontine'));
    if (info.project.name === 'android-chromium')
      await page.screenshot({ path: `${out}/${actor}-tontine-390.png`, fullPage: true });
    await evidence(`metier-${actor}-${info.project.name}`, records);
  });
}
