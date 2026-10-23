import { mockSpace } from './pwa-space';
import { chooseCampaign } from './campaign-choice';
import { test, expect } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });

test('accueil : épargne par défaut, QR et encaissement dans la campagne choisie', async ({
  page,
}) => {
  if (!process.env.DEMO_PASSWORD) throw new Error('DEMO_PASSWORD requis.');
  await mockSpace(page, true, 8);
  await page.route('**/shortcuts', (route) =>
    route.fulfill({
      json: {
        campaignIds: [
          '11111111-1111-4111-a111-111111111111',
          '22222222-2222-4222-a222-222222222222',
          ...Array.from(
            { length: 4 },
            (_, i) => `11111111-1111-4111-a111-${String(i + 2).padStart(12, '0')}`,
          ),
        ],
      },
    }),
  );
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/savings-session', (route) =>
    route.fulfill({
      json: { today: '2026-10-20', scheduled: true, opened: true, can_collect: true },
    }),
  );
  await page.route('**/tontine/status', (route) =>
    route.fulfill({
      json: {
        today: '2026-10-21',
        round_number: 1,
        round_date: '2026-10-21',
        scheduled: true,
        drawn: true,
        can_draw: false,
        can_collect: true,
        beneficiary_name: 'Awa Fall',
      },
    }),
  );
  await page.goto('/');
  await page.getByLabel('Identifiant', { exact: true }).fill('admin.ndeye');
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  const hero = page.locator('.pwa-action-home');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('button')).toHaveCount(4);
  for (const name of ['Accueil', 'Campagnes', 'Membres', 'Plus']) {
    await expect(nav.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(hero.locator('.pwa-day-heading h2')).toContainText('Épargne');
  await expect(page.getByLabel('Campagne suivie', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Contexte du groupement' })).toHaveCount(0);
  await expect(hero.locator('.overview-campaign-shortcut[aria-pressed="true"]')).toContainText(
    'Épargne',
  );
  const balance = hero.locator('.pwa-day-metrics strong').first();
  await expect(balance).toContainText('FCFA');
  const amountBefore = await balance.innerText();
  await hero.locator('.overview-campaign-shortcut[aria-pressed="true"]').tap();
  await expect(balance).toHaveText(amountBefore);
  for (const name of ['Coffre', 'Code QR', 'Archives', 'Tontines']) {
    await expect(hero.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  const qr = hero.getByRole('button', { name: 'Afficher le QR du groupement' });
  await expect(qr.locator('svg')).toBeVisible();
  await qr.tap();
  await expect(page.getByRole('dialog')).toContainText('Groupement');
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).first().tap();
  await expect(qr).toBeFocused();
  const choices = hero.locator('.overview-campaign-shortcut');
  expect(await choices.count()).toBeGreaterThan(1);
  const overflow = hero.getByRole('button', { name: 'Plus de campagnes', exact: true });
  expect(await hero.locator('.wave-actions-grid button').count()).toBeLessThanOrEqual(8);
  await expect(hero.getByRole('button', { name: 'Historique des cotisations' })).toBeVisible();
  const slotTops = await hero
    .locator('.wave-actions-grid > button')
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top));
  expect(new Set(slotTops.map(Math.round)).size).toBeLessThanOrEqual(2);
  if (await overflow.count()) {
    await overflow.tap();
    const more = page.getByRole('dialog', { name: 'Autres campagnes en cours' });
    await expect(more.locator('.overview-campaign-shortcut')).not.toHaveCount(0);
    const choice = more.locator('.overview-campaign-shortcut').first();
    const name = (await choice.getAttribute('title'))!;
    await choice.tap();
    await expect(more).toHaveCount(0);
    await expect(hero.locator('.pwa-day-heading h2')).toHaveText(name);
    await expect(
      hero.getByRole('button', { name: `Choisir la campagne ${name}`, exact: true }),
    ).toHaveCount(0);
    await expect(hero.getByRole('button', { name: 'Historique des cotisations' })).toBeVisible();
  }
  const choiceNames = await choices.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('title')!),
  );
  for (const name of choiceNames) {
    await chooseCampaign(page, name);
    await expect(hero.locator('.overview-campaign-shortcut[aria-pressed="true"]')).toHaveAttribute(
      'title',
      name,
    );
    await expect(hero.locator('.pwa-day-heading h2')).toHaveText(name);
    await expect(page.getByRole('region', { name: 'Action du jour', exact: true })).toContainText(
      name,
    );
    await hero.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }).tap();
    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByLabel('Campagne de l’encaissement').locator('option:checked'),
    ).toHaveText(name);
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).first().tap();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('accueil-campagnes.png') });
  await nav.getByRole('button', { name: 'Plus', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Membres', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter un membre', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chiffres', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Paramètres du groupement', exact: true }).tap();
  await page.getByRole('button', { name: 'Archives & Clôtures', exact: true }).tap();
  await expect(
    page.getByRole('heading', { name: /^Archives \(Groupements/, level: 1 }),
  ).toBeVisible();
});
