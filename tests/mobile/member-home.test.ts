import { loginPwa } from './fixtures';
import { test, expect } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });
const savingsId = '11111111-1111-4111-a111-111111111111',
  tontineId = '22222222-2222-4222-a222-222222222222';
async function setup(page: any, launched = true) {
  const campaigns = [
    {
      id: savingsId,
      name: 'Épargne membre',
      type_name: 'Avec Épargne',
      type_code: 'AVEC',
      participation_id: 'own-savings',
      forfait: null,
      is_random: true,
      arrears_count: 2,
      total_paid: '7000',
    },
    {
      id: tontineId,
      name: 'Tontine membre',
      type_name: 'Tontine rotative',
      type_code: 'TONTINE',
      participation_id: 'own-tontine',
      forfait: '2000',
      is_random: false,
      arrears_count: 0,
      total_paid: '4000',
    },
  ].map((c) => ({
    ...c,
    active: true,
    start_date: '2026-01-01',
    end_date: '2027-12-31',
    weekday: 3,
    interval_weeks: 1,
  }));
  let paid = false,
    posts = 0;
  const payments = Array.from({ length: 7 }, (_, i) => ({
    id: `pay-${i}`,
    participation_id: 'own-savings',
    name: 'Awa Fall',
    amount: '1000',
    paid_on: i < 2 ? '2026-10-14' : '2026-10-07',
    reference: `REF-${i}`,
    voided_at: null,
  }));
  const rounds = Array.from({ length: 7 }, (_, i) => ({
    round_number: 7 - i,
    expected_date: `2026-${String(10 - i).padStart(2, '0')}-02`,
    period_end: `2026-${String(11 - i).padStart(2, '0')}-02`,
    beneficiary_name: `Bénéficiaire ${7 - i}`,
    paid: i > 0,
    drawn: true,
    my_paid_amount: '2000',
  }));
  await page.route('**/member/campaigns', (r: any) =>
    r.fulfill({ json: { items: campaigns, total: 2 } }),
  );
  await page.route('**/member/campaigns?*', (r: any) =>
    r.fulfill({ json: { items: campaigns, total: 2 } }),
  );
  await page.route('**/member/campaigns/*', (r: any) =>
    r.fulfill({
      json: {
        today: '2026-10-21',
        can_pay: launched && !paid,
        already_paid: paid,
        reason: paid
          ? 'Versement déjà effectué pour cette séance ou ce tour.'
          : launched
            ? 'Versement disponible.'
            : 'Le tour en cours attend son tirage.',
        total_paid: paid ? '9500' : r.request().url().endsWith(savingsId) ? '7000' : '4000',
        sessions: ['2026-10-21', '2026-10-14', '2026-10-07'],
        rounds,
        payouts_count: 6,
        remaining_months: 1,
      },
    }),
  );
  let pins = [savingsId, tontineId];
  await page.route('**/member/campaigns/shortcuts', (r: any) => {
    if (r.request().method() === 'PUT') pins = r.request().postDataJSON().campaignIds;
    return r.fulfill({ json: { campaignIds: pins } });
  });
  await page.route('**/contributions?*', (r: any) => {
    const url = new URL(r.request().url());
    expect(url.searchParams.get('scope')).toBe('personal');
    const items = payments.filter(
      (p) => !url.searchParams.get('paidOn') || p.paid_on === url.searchParams.get('paidOn'),
    );
    const p = Number(url.searchParams.get('page') || 1),
      limit = Number(url.searchParams.get('limit'));
    return r.fulfill({
      json: { items: items.slice((p - 1) * limit, p * limit), total: items.length },
    });
  });
  await page.route('**/contributions/self', (r: any) => {
    const body = r.request().postDataJSON();
    expect(Object.keys(body).sort()).toEqual(['amount', 'idempotencyKey', 'paidOn']);
    expect(body.idempotencyKey).toMatch(/^[\da-f-]{36}$/);
    posts++;
    paid = true;
    payments.unshift({
      id: 'new-pay',
      participation_id: 'own-savings',
      name: 'Awa Fall',
      amount: String(body.amount),
      paid_on: '2026-10-21',
      reference: 'REF-NEW',
      voided_at: null,
    });
    return r.fulfill({ status: 201, json: payments[0] });
  });
  await page.goto('/');
  await loginPwa(page, 'membre.awa');
  return { posts: () => posts };
}
test('membre épargne : accueil groupement, badge, cinq versements, filtre et versement unique', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const state = await setup(page);
  const hero = page.locator('.member-portal .pwa-action-home');
  await expect(hero).toContainText('Les Femmes de Grand Yoff');
  await expect(hero.locator('.pwa-compact-identity')).toContainText('Awa Fall');
  await expect(
    page.getByRole('region', { name: 'Montant collecté pour cette épargne', exact: true }),
  ).toContainText(/7.?000 FCFA/);
  await expect(page.getByLabel('2 séance(s) non cotisée(s)', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Choisir la campagne Épargne membre', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const cards = page.locator('.member-payment-card');
  await expect(cards).toHaveCount(5);
  await expect(cards.first().locator('.compact-card-line')).toHaveCount(3);
  await page.getByRole('button', { name: 'Voir plus de versements', exact: true }).tap();
  await expect(cards).toHaveCount(7);
  await page
    .getByRole('combobox', { name: 'Filtrer par séance', exact: true })
    .selectOption('2026-10-14');
  await expect(cards).toHaveCount(2);
  const pay = page.getByRole('button', { name: /^Faire un versement/ });
  await expect(pay).toBeEnabled();
  await pay.tap();
  const dialog = page.getByRole('dialog', { name: 'Faire un versement', exact: true });
  await dialog.getByLabel('Montant à verser (FCFA)', { exact: true }).fill('2500');
  await dialog.getByRole('button', { name: 'Vérifier mon versement', exact: true }).tap();
  expect(state.posts()).toBe(0);
  await page
    .getByRole('dialog', { name: 'Vérifier mon versement', exact: true })
    .getByRole('button', { name: 'Confirmer mon versement', exact: true })
    .tap();
  await expect(dialog).toHaveCount(0);
  await expect(pay).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Montant collecté pour cette épargne', exact: true }),
  ).toContainText(/9.?500 FCFA/);
  expect(state.posts()).toBe(1);
  await expect(
    page.getByRole('dialog', { name: 'Versement confirmé' }).getByText('REF-NEW', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('membre-epargne.png'), fullPage: true });
});
test('membre tontine : tirage requis, forfait commun, bénéficiaires, cinq tours et filtre', async ({
  page,
}) => {
  await setup(page, false);
  const identity = page.getByRole('region', {
    name: 'Identité du groupement et du membre',
    exact: true,
  });
  await expect(identity).toContainText('Les Femmes de Grand Yoff');
  await expect(identity).toContainText('Awa Fall');
  expect(
    await identity.locator('strong').evaluate((el) => Number(getComputedStyle(el).fontWeight)),
  ).toBeGreaterThanOrEqual(700);
  await identity.getByRole('button', { name: 'Présenter mon QR' }).click();
  const card = page.getByRole('dialog');
  await expect(card).toContainText('membre.awa');
  await expect(card).toContainText('+221770000002');
  await expect(card).toContainText('Grand Yoff, Dakar');
  expect((await card.locator('.qr-box svg').boundingBox())!.width).toBeGreaterThanOrEqual(180);
  await card.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mon Code QR', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Choisir la campagne Épargne membre', exact: true }),
  ).toBeVisible();
  await expect(identity.locator('svg')).toHaveCount(1);
  await expect(identity).not.toContainText('FCFA');
  await expect(identity).not.toContainText('Épargne membre');
  const before = await identity.innerHTML();
  const layout = await identity.evaluate((el) => ({
    rows: getComputedStyle(el).gridTemplateRows.split(' ').length,
    qr: el.querySelector('svg')!.getBoundingClientRect().width,
    color: getComputedStyle(el).backgroundColor,
    height: el.getBoundingClientRect().height,
  }));
  expect(layout.height).toBeLessThanOrEqual(110);
  expect(layout.qr).toBeLessThanOrEqual(24);
  await page.getByRole('button', { name: 'Choisir la campagne Tontine membre', exact: true }).tap();
  const pay = page.getByRole('button', { name: /^Faire un versement/ });
  await expect(pay).toBeDisabled();
  await expect(
    page.getByText('Le tour en cours attend son tirage.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Suivi de la tontine' })).toContainText('6');
  const cards = page.locator('.member-round-card');
  await expect(cards).toHaveCount(5);
  await expect(cards.first().locator('.compact-card-line')).toHaveCount(3);
  expect(await identity.innerHTML()).toBe(before);
  expect(await identity.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(layout.color);
  expect((await identity.boundingBox())!.height).toBe(layout.height);
  await page.getByRole('button', { name: 'Voir plus de tours', exact: true }).tap();
  await expect(cards).toHaveCount(7);
  await page.getByRole('combobox', { name: 'Filtrer par tour', exact: true }).selectOption('2');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('Bénéficiaire 2');
  // The group administrator launches the tour; returning to the app refreshes eligibility.
  await page.route('**/member/campaigns/' + tontineId, (r) =>
    r.fulfill({
      json: {
        today: '2026-10-21',
        can_pay: true,
        already_paid: false,
        reason: 'Versement disponible.',
        total_paid: '4000',
        sessions: [],
        rounds: [],
        payouts_count: 6,
        remaining_months: 1,
      },
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(pay).toBeEnabled();
  await pay.tap();
  const dialog = page.getByRole('dialog', { name: 'Faire un versement', exact: true });
  await expect(dialog.getByLabel('Montant à verser (FCFA)', { exact: true })).toHaveValue('2000');
  await expect(dialog.getByLabel('Montant à verser (FCFA)', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
