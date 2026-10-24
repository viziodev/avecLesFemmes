import { test, expect, unlockReturning } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });
const a = '11111111-1111-4111-a111-111111111111',
  b = '22222222-2222-4222-a222-222222222222',
  t = '33333333-3333-4333-a333-333333333333',
  old = '44444444-4444-4444-a444-444444444444';
const avec = '55555555-5555-4555-a555-555555555555',
  tontine = '66666666-6666-4666-a666-666666666666';
async function setup(page: any) {
  const campaigns = [
    {
      id: a,
      name: 'Épargne principale',
      type_id: avec,
      type_name: 'Avec Épargne',
      type_code: 'AVEC',
      unpaid_count: 3,
      total_paid: '7000',
    },
    {
      id: b,
      name: 'Épargne projet',
      type_id: avec,
      type_name: 'Avec Épargne',
      type_code: 'AVEC',
      unpaid_count: 0,
      total_paid: '2000',
    },
    {
      id: t,
      name: 'Tontine membre',
      type_id: tontine,
      type_name: 'Tontine rotative',
      type_code: 'TONTINE',
      unpaid_count: 2,
      total_paid: '4000',
    },
  ].map((c) => ({
    ...c,
    active: true,
    start_date: '2026-01-01',
    end_date: '2027-12-31',
    weekday: 3,
    interval_weeks: 1,
    participation_id: c.id,
    is_random: true,
    forfait: null,
    arrears_count: 0,
  }));
  const catalog = [
    ...campaigns,
    { ...campaigns[0], id: old, name: 'Épargne archivée', active: false },
  ];
  const payments = Array.from({ length: 30 }, (_, i) => {
    const c = i === 0 ? catalog[3] : i < 10 ? campaigns[0] : i < 20 ? campaigns[1] : campaigns[2];
    return {
      id: `payment-${i}`,
      participation_id: c.id,
      name: 'Awa Fall',
      amount: '1000',
      paid_on: i >= 10 && i < 20 ? '2026-10-14' : '2026-10-21',
      created_at: '2026-10-21T12:00:00Z',
      reference: `REF-${i}`,
      voided_at: i === 29 ? '2026-10-21' : null,
      campaign_id: c.id,
      campaign_name: c.name,
      campaign_active: c.active,
      type_id: c.type_id,
      type_name: c.type_name,
      type_code: c.type_code,
      session_date:
        c.type_code === 'AVEC' ? (i >= 10 && i < 20 ? '2026-10-14' : '2026-10-21') : null,
      round_number: c.type_code === 'TONTINE' ? 2 : null,
    };
  });
  let pins = [a, t],
    fail = false;
  await page.route('**/member/campaigns?*', (r: any) =>
    r.fulfill({ json: { items: campaigns, total: 3 } }),
  );
  await page.route('**/member/campaigns/*', (r: any) => {
    if (r.request().url().endsWith('/shortcuts')) {
      if (r.request().method() === 'PUT') {
        if (fail) {
          fail = false;
          return r.fulfill({ status: 503, json: { message: 'Enregistrement indisponible' } });
        }
        pins = r.request().postDataJSON().campaignIds;
      }
      return r.fulfill({ json: { campaignIds: pins } });
    }
    return r.fulfill({
      json: {
        today: '2026-10-21',
        can_pay: false,
        already_paid: true,
        reason: 'Versement déjà effectué.',
        total_paid: r.request().url().endsWith(a) ? '7000' : '4000',
        sessions: ['2026-10-21'],
        rounds: [],
        payouts_count: 1,
        remaining_months: 2,
      },
    });
  });
  await page.route('**/contributions?*', (r: any) => r.fulfill({ json: { items: [], total: 0 } }));
  await page.route('**/member/history/options', (r: any) =>
    r.fulfill({
      json: {
        campaigns: catalog,
        sessions: ['2026-10-21', '2026-10-14'],
        rounds: [
          {
            key: t + ':2',
            campaign_id: t,
            campaign_name: 'Tontine membre',
            round_number: 2,
            expected_date: '2026-10-21',
          },
        ],
      },
    }),
  );
  await page.route('**/member/history?*', (r: any) => {
    const url = new URL(r.request().url());
    const values = (key: string) => url.searchParams.getAll(key).flatMap((v) => v.split(','));
    const cs = values('campaignIds'),
      ts = values('typeIds'),
      ss = values('sessions'),
      rs = values('rounds');
    const selected = payments.filter(
      (p) =>
        (!cs.length || cs.includes(p.campaign_id)) &&
        (!ts.length || ts.includes(p.type_id)) &&
        ((!ss.length && !rs.length) ||
          (p.session_date && ss.includes(p.session_date)) ||
          (p.round_number && rs.includes(p.campaign_id + ':' + p.round_number))),
    );
    const pageNum = Number(url.searchParams.get('page') || 1),
      limit = Number(url.searchParams.get('limit') || 25);
    return r.fulfill({
      json: {
        items: selected.slice((pageNum - 1) * limit, pageNum * limit),
        total: selected.length,
        total_paid: String(selected.filter((p) => !p.voided_at).length * 1000),
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Identifiant', { exact: true }).fill('membre.awa');
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.DEMO_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).tap();
  return {
    failNext: () => {
      fail = true;
    },
  };
}
test('membre : montant avant versements, choix persistants et badges épargne/tontine', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const state = await setup(page);
  const collected = page.getByRole('region', {
    name: 'Montant collecté pour cette épargne',
    exact: true,
  });
  await expect(collected).toContainText(/7.?000 FCFA/);
  const list = page.getByRole('region', { name: 'Mes versements d’épargne', exact: true });
  expect((await collected.boundingBox())!.y).toBeLessThan((await list.boundingBox())!.y);
  await expect(page.getByLabel('3 séance(s) non cotisée(s)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('2 tour(s) non cotisé(s)', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Choisir la campagne Épargne projet', exact: true }),
  ).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Mes campagnes', exact: true }).tap();
  await expect(page.locator('.member-campaign-options .member-campaign-option')).toHaveCount(2);
  await expect(page.locator('.member-campaign-options')).not.toContainText('Épargne projet');
  await page.getByRole('button', { name: 'Choisir mes campagnes', exact: true }).tap();
  await page
    .getByRole('checkbox', { name: 'Afficher Épargne principale sur l’accueil', exact: true })
    .uncheck();
  await expect(
    page.getByRole('checkbox', { name: 'Afficher Épargne projet sur l’accueil', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('checkbox', { name: 'Afficher Épargne projet sur l’accueil', exact: true })
    .check();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).tap();
  await expect(page.locator('.member-campaign-options .member-campaign-option')).toHaveCount(2);
  await expect(page.locator('.member-campaign-options')).toContainText('Épargne projet');
  await expect(page.locator('.member-campaign-options')).not.toContainText('Épargne principale');
  await nav.getByRole('button', { name: 'Accueil', exact: true }).tap();
  await expect(
    page.getByRole('button', { name: 'Choisir la campagne Épargne principale', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Choisir la campagne Épargne projet', exact: true }),
  ).toBeVisible();
  await page.reload();
  await unlockReturning(page);
  await expect(
    page.getByRole('button', { name: 'Choisir la campagne Épargne projet', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Plus de campagnes', exact: true }).tap();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Choisir la campagne Épargne principale', exact: true })
    .tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.wave-actions-grid .overview-campaign-shortcut')).toHaveCount(2);
  await expect(
    page
      .locator('.wave-actions-grid')
      .getByRole('button', { name: 'Choisir la campagne Épargne principale', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Plus de campagnes', exact: true }).tap();
  const more = page.getByRole('dialog', { name: 'Autres campagnes en cours', exact: true });
  await more
    .getByRole('checkbox', { name: 'Afficher Épargne principale sur l’accueil', exact: true })
    .tap();
  await expect(more).toContainText('Toutes vos campagnes actives sont sur l’accueil.');
  await expect(more.getByRole('checkbox')).toHaveCount(0);
  await more.getByRole('button', { name: 'Fermer', exact: true }).tap();
  await expect(page.locator('.wave-actions-grid .overview-campaign-shortcut')).toHaveCount(3);
  await page.reload();
  await unlockReturning(page);
  await expect(page.locator('.wave-actions-grid .overview-campaign-shortcut')).toHaveCount(3);
  await nav.getByRole('button', { name: 'Mes campagnes', exact: true }).tap();
  await expect(page.locator('.member-campaign-options .member-campaign-option')).toHaveCount(3);
  await page.getByRole('button', { name: 'Choisir mes campagnes', exact: true }).tap();
  for (const name of ['Épargne principale', 'Épargne projet', 'Tontine membre']) {
    const c = page.getByRole('checkbox', { name: `Afficher ${name} sur l’accueil`, exact: true });
    await expect(c).toBeEnabled();
    await c.uncheck();
  }
  await expect(
    page.getByRole('checkbox', { name: 'Afficher Épargne principale sur l’accueil', exact: true }),
  ).toBeEnabled();
  state.failNext();
  await page
    .getByRole('checkbox', { name: 'Afficher Épargne principale sur l’accueil', exact: true })
    .tap();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Enregistrement indisponible',
  );
  await expect(
    page.getByRole('checkbox', { name: 'Afficher Épargne principale sur l’accueil', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).tap();
  await expect(page.locator('.member-campaign-options .member-campaign-option')).toHaveCount(0);
  await expect(page.getByText(/Aucune campagne sélectionnée/)).toBeVisible();
  await nav.getByRole('button', { name: 'Accueil', exact: true }).tap();
  await expect(page.locator('.wave-actions-grid .overview-campaign-shortcut')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Historique de mes versements', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('membre : historique global, archives et filtres cumulés sans campagne suivie', async ({
  page,
}) => {
  test.setTimeout(60000);
  await setup(page);
  await page.getByRole('button', { name: 'Historique de mes versements', exact: true }).tap();
  const history = page.getByRole('region', { name: 'Historique de mes versements', exact: true }),
    cards = history.locator('.member-payment-card');
  await expect(cards).toHaveCount(5);
  await expect(history).toContainText('Épargne archivée');
  await expect(cards.first().locator('.compact-card-line')).toHaveCount(3);
  await expect(page.getByLabel('Campagne suivie', { exact: true })).toHaveCount(0);
  await history.getByRole('button', { name: 'Voir plus de versements', exact: true }).tap();
  await expect(cards).toHaveCount(10);
  await history.locator('.member-history-filters > summary').tap();
  await history
    .locator('.member-history-filter-group')
    .filter({ hasText: 'Types de cotisation' })
    .locator('summary')
    .tap();
  const types = history.getByRole('group', { name: 'Types de cotisation', exact: true });
  await types.getByRole('checkbox', { name: 'Avec Épargne', exact: true }).check();
  await expect(history.locator('.member-history-summary')).toContainText('20 versement(s)');
  await expect(cards).toHaveCount(5);
  await history
    .locator('.member-history-filter-group')
    .filter({ hasText: 'Campagnes' })
    .locator('summary')
    .tap();
  const campaigns = history.getByRole('group', { name: 'Campagnes', exact: true });
  await campaigns.getByRole('checkbox', { name: 'Épargne principale', exact: true }).check();
  await expect(history.locator('.member-history-summary')).toContainText('9 versement(s)');
  await expect(cards).toHaveCount(5);
  await types.getByRole('checkbox', { name: 'Tontine rotative', exact: true }).check();
  await campaigns.getByRole('checkbox', { name: 'Tontine membre', exact: true }).check();
  await expect(history.locator('.member-history-summary')).toContainText('19 versement(s)');
  await expect(cards).toHaveCount(5);
  await history
    .locator('.member-history-filter-group')
    .filter({ hasText: 'Séances d’épargne' })
    .locator('summary')
    .tap();
  const sessions = history.getByRole('group', { name: 'Séances d’épargne', exact: true });
  await sessions.getByRole('checkbox', { name: /14 oct/ }).check();
  await expect(cards).toHaveCount(0);
  await history
    .locator('.member-history-filter-group')
    .filter({ hasText: 'Tours de tontine' })
    .locator('summary')
    .tap();
  await history
    .getByRole('group', { name: 'Tours de tontine', exact: true })
    .getByRole('checkbox', { name: /Tour 2/ })
    .check();
  await expect(history.locator('.member-history-summary')).toContainText('10 versement(s)');
  await expect(cards).toHaveCount(5);
  await campaigns.getByRole('checkbox', { name: 'Épargne projet', exact: true }).check();
  await expect(history.locator('.member-history-summary')).toContainText('20 versement(s)');
  await expect(cards).toHaveCount(5);
  for (let i = 0; i < 3; i++) {
    await history.getByRole('button', { name: 'Voir plus de versements', exact: true }).tap();
    await expect(cards).toHaveCount(10 + i * 5);
  }
  await expect(cards.filter({ hasText: 'Tour 2' })).toHaveCount(10);
  await expect(cards.filter({ hasText: 'Séance du' })).toHaveCount(10);
  await history.getByRole('button', { name: 'Effacer les filtres', exact: true }).tap();
  await expect(cards).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: test.info().outputPath('historique-global-membre.png'),
    fullPage: true,
  });
});
