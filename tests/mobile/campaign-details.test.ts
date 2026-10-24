import { loginPwa } from './fixtures';
import { mockDemoTontine } from './demo-tontine';
import { chooseCampaign } from './campaign-choice';
import { test, expect } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => mockDemoTontine(page));

test('séances et rotations en cartes : détails, libellés et état vide', async ({ page }) => {
  if (!process.env.DEMO_PASSWORD) throw new Error('DEMO_PASSWORD requis.');
  await page.setViewportSize({ width: 360, height: 800 });
  const contribution = {
    contribution_id: 'test-contribution',
    member_name: 'Awa Fall Ndiaye — groupement des femmes de Grand Yoff',
    amount: '1500',
    reference: 'REFERENCE-TEST-TRES-LONGUE-012345678901234567890',
  };
  let empty = false;
  await page.route('**/sessions', (route) =>
    route.fulfill({
      json: empty
        ? []
        : [
            {
              session_date: '2026-06-02',
              total_amount: '1500',
              count: 1,
              members_count: 1,
              contributions: [contribution],
            },
          ],
    }),
  );
  await page.route('**/tontine/rounds', (route) =>
    route.fulfill({
      json: [
        {
          id: 'round-test',
          round_number: 1,
          beneficiary_id: 'member-test',
          beneficiary_name: contribution.member_name,
          expected_date: '2026-06-02',
          payout_amount: '1500',
          total_collected_amount: '1500',
          paid: true,
          paid_at: '2026-06-02',
          contributions: [contribution],
        },
      ],
    }),
  );
  await page.route('**/tontine/members*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            member_id: 'member-test',
            member_name: contribution.member_name,
            paid_amount: '1500',
            expected_amount: '1500',
            contributed: true,
          },
        ],
        total: 1,
        contributed_count: 1,
        unpaid_count: 0,
        period_start: '2026-06-02',
        period_end: '2026-07-02',
      },
    }),
  );
  await page.goto('/');
  await loginPwa(page, 'admin.ndeye');
  await chooseCampaign(page, 'Tontine solidaire 2026');
  const rounds = page.getByRole('region', { name: 'Tours de tontine' });
  await expect(rounds).toBeVisible();
  await rounds.locator('summary').first().tap();
  await expect(rounds.locator('.session-attendance')).toContainText(contribution.member_name);
  await expect(
    page.getByRole('heading', { name: 'Membres de la tontine', exact: true }),
  ).toHaveCount(0);
  expect(await rounds.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await page.getByRole('button', { name: 'Afficher le QR du groupement', exact: true }).click();
  const groupCard = page.getByRole('dialog');
  await expect(groupCard).toContainText('Les Femmes de Grand Yoff');
  await expect(groupCard).toContainText('+221770000002');
  await expect(groupCard).toContainText('membre(s)');
  await groupCard.getByRole('button', { name: 'Fermer', exact: true }).click();
  await nav.getByRole('button', { name: 'Campagnes', exact: true }).tap();
  await expect(page.getByRole('table', { name: 'Participantes de la tontine' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /1\. Participantes et forfaits/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /2\. Sessions/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Délai de grâce', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Informations du groupement' })).toHaveCount(0);
  await expect(page.getByLabel('Contexte du groupement')).toHaveCount(0);
  const campaignCards = page.locator('.campaign-card-entry');
  expect(await campaignCards.count()).toBeGreaterThan(0);
  for (const card of await campaignCards.all()) {
    const lines = card.locator('summary .compact-card-line');
    await expect(lines).toHaveCount(4);
    const heights = await lines.evaluateAll((nodes) =>
      nodes.map((n) => n.getBoundingClientRect().height),
    );
    // Four logical lines remain compact with the charter's 16px headings.
    expect(Math.max(...heights)).toBeLessThanOrEqual(24);
    await expect(
      card.getByRole('button', { name: 'Ajouter un membre', exact: true }),
    ).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('campagnes-simplifiees.png') });
});
