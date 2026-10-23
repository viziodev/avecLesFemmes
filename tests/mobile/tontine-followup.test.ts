import { mockDemoTontine } from './demo-tontine';
import { chooseCampaign } from './campaign-choice';
import { test, expect } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => mockDemoTontine(page));

test('tontine : trois totaux sur une ligne, membres filtrés par tour et état', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/cashbox', (route) =>
    route.fulfill({ json: { balance: '3000', total_collected: '9000', total_paid_out: '6000' } }),
  );
  await page.route('**/tontine/rounds', (route) =>
    route.fulfill({
      json: [1, 2].map((n) => ({
        id: `round-${n}`,
        round_number: n,
        beneficiary_id: `member-${n}`,
        beneficiary_name: n === 1 ? 'Awa Fall' : 'Ndèye Diop',
        expected_date: n === 1 ? '2026-06-02' : '2026-07-02',
        payout_amount: '6000',
        paid: n === 1,
        contributions: [],
      })),
    }),
  );
  await page.route('**/tontine/members*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const round = params.get('roundNumber') || '1';
    const members = ['Awa Fall', 'Ndèye Diop', 'Mariama Bâ'].map((member_name, i) => {
      const amount = round === '1' ? [1000, 0, 2000][i] : [0, 2000, 0][i];
      return {
        member_id: `m-${i}`,
        member_name,
        paid_amount: String(amount),
        expected_amount: '2000',
        contributed: amount > 0,
      };
    });
    const norm = (v: string) =>
      v
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const state = params.get('state');
    const items = members.filter(
      (m) =>
        norm(m.member_name).includes(norm(params.get('q') || '')) &&
        (state === 'all' || m.contributed === (state === 'paid')),
    );
    return route.fulfill({
      json: {
        items,
        total: items.length,
        contributed_count: members.filter((m) => m.contributed).length,
        unpaid_count: members.filter((m) => !m.contributed).length,
        period_start: round === '1' ? '2026-06-02' : '2026-07-02',
        period_end: round === '1' ? '2026-07-02' : '2026-08-02',
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Identifiant', { exact: true }).fill('admin.ndeye');
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.DEMO_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await chooseCampaign(page, 'Tontine solidaire 2026');
  const totals = page.locator('.pwa-day-metrics.three');
  await expect(totals.locator(':scope > div')).toHaveCount(3);
  for (const label of ['À cotiser / membre', 'Total encaissé', 'Total reversé'])
    await expect(totals.getByText(label, { exact: true })).toBeVisible();
  await expect(totals).toContainText(/9.?000 FCFA/);
  await expect(totals).toContainText(/6.?000 FCFA/);
  const tops = await totals
    .locator(':scope > div')
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2);
  const cards = page.getByRole('region', { name: 'Tours de tontine' });
  await cards.locator('summary').first().click();
  const roster = cards.locator('details').first();
  await expect(roster.locator('.session-attendance li')).toHaveCount(3);
  await roster.getByLabel('État de cotisation du tour 2').selectOption('unpaid');
  await expect(roster.locator('.not-contributed')).toHaveCount(2);
  await expect(roster.locator('.contributed')).toHaveCount(0);
  await roster.getByLabel('Rechercher un membre du tour 2', { exact: true }).fill('ndeye');
  await expect(roster).toContainText('Aucun membre pour ces critères');
  await roster.getByLabel('État de cotisation du tour 2').selectOption('all');
  await expect(roster.locator('.session-attendance li')).toHaveCount(1);
  await expect(roster.locator('.contributed')).toContainText('Ndèye Diop');
  await cards.locator('summary').nth(1).click();
  const other = cards.locator('details').nth(1);
  await other.getByLabel('Rechercher un membre du tour 1', { exact: true }).fill('ndeye');
  await expect(other.locator('.not-contributed')).toContainText('Ndèye Diop');
  await expect(
    page.getByRole('heading', { name: 'Membres de la tontine', exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('membres-tontine.png') });
});

test('tontine : tirage du jour puis encaissement, sans attribution des tours futurs', async ({
  page,
}) => {
  let drawn = false;
  await page.route('**/tontine/status', (route) =>
    route.fulfill({
      json: {
        today: '2026-10-21',
        round_number: 1,
        round_date: '2026-10-21',
        scheduled: true,
        drawn,
        can_draw: !drawn,
        can_collect: drawn,
        beneficiary_name: drawn ? 'Awa Fall' : null,
      },
    }),
  );
  await page.route('**/tontine/rounds', (route) =>
    route.fulfill({
      json: [1, 2, 3].map((n) => ({
        id: `r-${n}`,
        round_number: n,
        expected_date: n === 1 ? '2026-10-21' : n === 2 ? '2026-11-21' : '2026-12-21',
        payout_amount: '6000',
        total_collected_amount: '0',
        beneficiary_id: n === 1 && drawn ? 'member-awa' : null,
        beneficiary_name: n === 1 && drawn ? 'Awa Fall' : null,
        drawn_at: n === 1 && drawn ? '2026-10-21T10:00:00Z' : null,
        paid: false,
        paid_at: null,
        unpaid_count: 3,
        contributions: [],
      })),
    }),
  );
  await page.route('**/tontine/draw', (route) => {
    drawn = true;
    return route.fulfill({ json: [{ id: 'r-1', beneficiary_name: 'Awa Fall' }] });
  });
  await page.goto('/');
  await page.getByLabel('Identifiant', { exact: true }).fill('admin.ndeye');
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.DEMO_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await chooseCampaign(page, 'Tontine solidaire 2026');
  const draw = page.getByRole('button', { name: 'Tirer la bénéficiaire du tour 1', exact: true });
  await expect(draw).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Scanner le QR d’une membre', exact: true }),
  ).toHaveCount(0);
  await draw.click();
  const collect = page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true });
  await expect(collect).toBeVisible();
  const cards = page.getByRole('region', { name: 'Tours de tontine' });
  await expect(cards.locator('summary').first()).toContainText('Bénéficiaire : Awa Fall');
  await expect(cards.locator('summary')).toHaveCount(1);
  await expect(cards.getByRole('heading', { name: 'Tour du jour', exact: true })).toBeVisible();
  await collect.click();
  await expect(page.getByLabel('Date du versement', { exact: true })).toHaveValue('2026-10-21');
  await expect(page.getByLabel('Date du versement', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
});

test('tontine : tour du jour, trois tours passés, voir plus et délai individuel', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-21T12:00:00Z'));
  const days = [
    '2026-09-09',
    '2026-09-16',
    '2026-09-23',
    '2026-09-30',
    '2026-10-07',
    '2026-10-14',
    '2026-10-21',
    '2026-10-28',
  ];
  let deadline: string | null = null;
  let saved: unknown;
  await page.route('**/tontine/status', (route) =>
    route.fulfill({
      json: {
        today: '2026-10-21',
        round_number: 7,
        round_date: '2026-10-21',
        scheduled: true,
        drawn: true,
        can_draw: false,
        can_collect: true,
        beneficiary_name: 'Awa Fall',
      },
    }),
  );
  await page.route('**/tontine/rounds', (route) =>
    route.fulfill({
      json: [3, 8, 1, 7, 2, 6, 4, 5].map((n) => ({
        id: `r-${n}`,
        round_number: n,
        expected_date: days[n - 1],
        beneficiary_id: n === 8 ? null : 'awa',
        beneficiary_name: n === 8 ? null : 'Awa Fall',
        payout_amount: '6000',
        total_collected_amount: '2000',
        paid: false,
        unpaid_count: 2,
      })),
    }),
  );
  await page.route('**/tontine/members*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            member_id: 'awa',
            member_name: 'Awa Fall',
            paid_amount: '0',
            contributed: false,
            is_beneficiary: true,
            expected_amount: '2000',
            can_grant_grace: true,
          },
          {
            member_id: 'mariama',
            member_name: 'Mariama Bâ',
            paid_amount: '0',
            contributed: false,
            expected_amount: '2000',
            grace_deadline: deadline,
            absent: false,
            can_grant_grace: true,
          },
        ],
        total: 2,
        contributed_count: 1,
        unpaid_count: 1,
        period_start: '2026-10-21',
        period_end: '2026-10-28',
      },
    }),
  );
  await page.route('**/grace-periods', (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
    saved = route.request().postDataJSON();
    deadline = '2026-10-23';
    return route.fulfill({ status: 201, json: { id: 'grace-test' } });
  });
  await page.goto('/');
  await page.getByLabel('Identifiant', { exact: true }).fill('admin.ndeye');
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.DEMO_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await chooseCampaign(page, 'Tontine solidaire 2026');
  const cards = page.getByRole('region', { name: 'Tours de tontine' });
  await expect(cards.locator('summary')).toHaveCount(4);
  const compactRows = cards
    .locator('summary')
    .first()
    .locator('.compact-session-body > .compact-card-line');
  await expect(compactRows).toHaveCount(3);
  expect(
    Math.max(
      ...(await compactRows.evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().height),
      )),
    ),
  ).toBeLessThanOrEqual(24);

  const numbers = () => cards.locator('.session-date-heading').allTextContents();
  expect((await numbers()).map((v) => v.trim().split(' · ')[0])).toEqual([
    'Tour 7',
    'Tour 6',
    'Tour 5',
    'Tour 4',
  ]);
  await expect(cards.getByRole('heading', { name: 'Tour du jour', exact: true })).toBeVisible();
  await cards.getByRole('button', { name: 'Voir plus de tours', exact: true }).click();
  await expect(cards.locator('summary')).toHaveCount(7);
  expect((await numbers()).map((v) => v.trim().split(' · ')[0])).toEqual([
    'Tour 7',
    'Tour 6',
    'Tour 5',
    'Tour 4',
    'Tour 3',
    'Tour 2',
    'Tour 1',
  ]);
  await cards.getByRole('button', { name: 'Voir moins de tours', exact: true }).click();
  await expect(cards.locator('summary')).toHaveCount(4);
  const current = cards.locator('details').first();
  await current.locator('summary').click();
  const beneficiary = current.locator('.session-attendance li', { hasText: 'Awa Fall' });
  await expect(beneficiary).toContainText('Bénéficiaire du tour');
  await expect(beneficiary.getByRole('button', { name: /délai/ })).toHaveCount(0);

  await expect(current.getByRole('button', { name: 'Accorder un délai', exact: true })).toHaveCount(
    1,
  );
  await current.getByRole('button', { name: 'Accorder un délai', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Délai de grâce', exact: true });
  await expect(dialog).toContainText('Mariama Bâ');
  const input = dialog.getByLabel('Nouvelle date limite', { exact: true });
  await expect(input).toHaveAttribute('min', '2026-10-21');
  await expect(input).toHaveAttribute('max', '2026-10-27');
  await input.fill('2026-10-23');
  await dialog.getByLabel('Motif (facultatif)', { exact: true }).fill('Déplacement familial');
  await dialog.getByRole('button', { name: 'Accorder le délai', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(current.locator('.grace-active')).toContainText('23 oct. 2026');
  expect(saved).toEqual({
    membershipId: 'mariama',
    periodDate: '2026-10-21',
    extendedDeadline: '2026-10-23',
    reason: 'Déplacement familial',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('tour-grace.png') });
});
