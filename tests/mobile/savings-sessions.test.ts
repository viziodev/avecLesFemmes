import { loginPwa } from './fixtures';
import { test, expect, unlockReturning } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });
test('épargne : cinq séances, voir plus et recherche de tous les membres', async ({ page }) => {
  if (!process.env.DEMO_PASSWORD) throw new Error('DEMO_PASSWORD requis.');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/sessions', (route) =>
    route.fulfill({
      json: [
        '2026-06-02',
        '2026-06-09',
        '2026-06-16',
        '2026-06-23',
        '2026-06-30',
        '2026-07-07',
        '2026-07-14',
      ].map((session_date) => ({
        session_date,
        total_amount: '500',
        expected_amount: '2000',
        free_members_count: 1,
        members_count: 1,
        count: 1,
        contributions: [],
        members: [
          {
            member_id: 'a',
            member_name: 'Awa',
            paid_amount: '500',
            expected_amount: '1000',
            contributed: true,
          },
          {
            member_id: 'b',
            member_name: 'Fatou',
            paid_amount: '0',
            expected_amount: '1000',
            contributed: false,
          },
          {
            member_id: 'c',
            member_name: 'Ndèye Diop',
            paid_amount: '0',
            expected_amount: null,
            contributed: false,
          },
        ],
      })),
    }),
  );
  await page.goto('/');
  await loginPwa(page, 'admin.ndeye');
  const section = page.getByRole('region', { name: 'Cahiers de séance d’épargne' });
  const summaries = section.locator('summary');
  await expect(summaries).toHaveCount(5);
  await expect(summaries.first()).toContainText('14 juil');
  await expect(summaries.nth(1)).toContainText('7 juil');
  const compact = summaries.first().locator('.compact-session-body > .compact-card-line');
  await expect(compact).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  // La charte autorise le retour à la ligne des montants : trois rangées logiques,
  // sans hauteur fixe ni coupure de chiffres selon la police et le navigateur.
  for (const row of await compact.all()) {
    expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await expect(compact.nth(1)).toContainText(/Versé.*500 FCFA/);
  await expect(compact.nth(1)).toContainText(/Attendu.*2.?000 FCFA/);

  await section.getByRole('button', { name: 'Voir plus de séances', exact: true }).tap();
  await expect(summaries).toHaveCount(7);
  await expect(summaries.last()).toContainText('2 juin');
  await section.getByRole('button', { name: 'Voir moins de séances', exact: true }).tap();
  await expect(summaries).toHaveCount(5);
  await summaries.first().tap();
  const expanded = section.locator('details[open]');
  await expect(expanded.locator('.contributed')).toContainText('Awa');
  await expect(expanded).toContainText('Versement partiel');
  await expect(expanded.locator('.not-contributed')).toHaveCount(2);
  await expect(expanded.locator('.unpaid-count')).toContainText('2 non cotisé(s)');
  await expect(expanded.locator('.unpaid-count')).toHaveCSS('color', 'rgb(180, 35, 50)');
  await expect(expanded.getByRole('button', { name: 'Encaissements de cette séance' })).toHaveCount(
    0,
  );
  const state = expanded.getByRole('combobox');
  await state.selectOption('paid');
  await expect(expanded.locator('.session-attendance li')).toHaveCount(1);
  await expect(expanded.locator('.contributed')).toContainText('Awa');
  await state.selectOption('unpaid');
  await expect(expanded.locator('.not-contributed')).toHaveCount(2);
  await expect(expanded.locator('.contributed')).toHaveCount(0);
  await state.selectOption('all');
  const search = expanded.getByRole('searchbox');
  await search.fill('FATOU');
  await expect(expanded.locator('.session-attendance li')).toHaveCount(1);
  await expect(expanded.locator('.not-contributed')).toContainText('Fatou');
  await search.fill('ndeye');
  await expect(expanded.locator('.session-attendance li')).toHaveCount(1);
  await expect(expanded.locator('.not-contributed')).toContainText('Ndèye Diop');
  await page.screenshot({ path: test.info().outputPath('recherche-membre-seance.png') });
  await summaries.nth(1).tap();
  await expect(section.locator('details').nth(1).getByRole('searchbox')).toHaveValue('');
  await summaries.nth(1).tap();
  await search.fill('Introuvable');
  await expect(expanded).toContainText('Aucun membre ne correspond');
  await expect(expanded.locator('.session-attendance li')).toHaveCount(0);
  await expanded.getByRole('button', { name: 'Effacer la recherche de cette séance' }).tap();
  await expect(expanded.locator('.contributed')).toContainText('Awa');
  await expect(expanded.locator('.not-contributed')).toHaveCount(2);
  await expect(expanded).toContainText('Montant libre');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('cahier-epargne.png') });
  await expect(page.getByRole('heading', { name: 'Suivi de campagne', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('heading', { name: 'Historique des cotisations', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Historique des cotisations', exact: true }).tap();
  await expect(
    page.getByRole('heading', { name: 'Historique des cotisations', level: 1 }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retour à l’accueil', exact: true }).tap();
  await expect(section).toBeVisible();
});

test('épargne : ouverture de séance avant encaissement, hors jour bloqué', async ({ page }) => {
  let opened = false;
  let scheduled = false;
  await page.route('**/savings-session', async (route) => {
    if (route.request().method() === 'POST') opened = true;
    await route.fulfill({
      json: { today: '2026-10-20', scheduled, opened, can_collect: scheduled && opened },
    });
  });
  await page.goto('/');
  await loginPwa(page, 'admin.ndeye');
  const hero = page.locator('.pwa-action-home');
  const open = hero.getByRole('button', { name: 'Ouvrir la séance d’épargne' });
  await expect(open).toBeDisabled();
  await expect(hero.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  scheduled = true;
  await page.reload();
  await unlockReturning(page);
  await expect(open).toBeEnabled();
  await open.tap();
  const collect = hero.getByRole('button', { name: 'Enregistrer une cotisation' });
  await expect(collect).toHaveText(/Encaisser épargne/);
  await collect.tap();
  await expect(page.getByLabel('Date du versement')).toHaveValue('2026-10-20');
  await expect(page.getByLabel('Date du versement')).toHaveAttribute('readonly', '');
});
