import { loginPwa } from './fixtures';
import { test, expect, unlockReturning } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });

test('campagnes : raccourcis persistants et ajout recherché, fixe ou libre', async ({ page }) => {
  const savings = '11111111-1111-4111-a111-111111111111',
    tontine = '22222222-2222-4222-a222-222222222222';
  const members = [
    { id: 'm-awa', name: 'Awa Fall', phone: null },
    { id: 'm-fatou', name: 'Fatou Diatta', phone: '+221771111111' },
    { id: 'm-bintou', name: 'Bintou Ndiaye', phone: null },
  ];
  let pins = [savings];
  const enrolled: Record<string, string[]> = { [savings]: [], [tontine]: ['m-awa'] };
  const saved: { campaignId: string; body: any }[] = [];
  const campaigns = [
    {
      id: tontine,
      name: 'Tontine adhésion',
      type_name: 'Tontine rotative',
      type_code: 'TONTINE',
      standard_amount: '2000',
    },
    {
      id: savings,
      name: 'Épargne adhésion',
      type_name: 'Avec Épargne',
      type_code: 'AVEC',
      standard_amount: '1500',
    },
  ].map((c) => ({
    ...c,
    start_date: '2026-10-21',
    end_date: '2027-10-21',
    active: true,
    weekday: 3,
    interval_weeks: 1,
    rule_version: 1,
    member_count: 0,
    collected_amount: '0',
  }));
  campaigns.push({
    ...campaigns[0],
    id: '33333333-3333-4333-a333-333333333333',
    name: 'Tontine archivée',
    active: false,
  });
  await page.route('**/campaigns?*', (route) =>
    route.fulfill({ json: { items: campaigns, total: campaigns.length } }),
  );
  await page.route('**/campaigns/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const match = /\/campaigns\/([^/]+)\/(.*)/.exec(url.pathname);
    if (url.pathname.endsWith('/campaigns/shortcuts')) {
      if (req.method() === 'PUT') pins = req.postDataJSON().campaignIds;
      return route.fulfill({ json: { campaignIds: pins } });
    }
    if (!match) return route.continue();
    const [, id, endpoint] = match;
    if (endpoint === 'eligible-members') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const items = members.filter(
        (m) => !enrolled[id].includes(m.id) && m.name.toLowerCase().includes(q),
      );
      return route.fulfill({ json: { items, total: items.length } });
    }
    if (endpoint === 'participants' && req.method() === 'POST') {
      const body = req.postDataJSON();
      saved.push({ campaignId: id, body });
      enrolled[id].push(body.membershipId);
      return route.fulfill({ status: 201, json: { id: 'participation-test', ...body } });
    }
    if (endpoint === 'participants' || endpoint === 'contributions')
      return route.fulfill({ json: { items: [], total: 0 } });
    if (endpoint === 'cashbox')
      return route.fulfill({ json: { balance: '0', total_collected: '0', total_paid_out: '0' } });
    if (endpoint === 'dashboard')
      return route.fulfill({ json: { personal: false, total: '0', payments: '0', members: '0' } });
    if (endpoint === 'savings-session')
      return route.fulfill({
        json: { today: '2026-10-21', scheduled: true, opened: true, can_collect: true },
      });
    if (endpoint === 'tontine/status')
      return route.fulfill({
        json: {
          today: '2026-10-21',
          round_number: 1,
          round_date: '2026-10-21',
          scheduled: true,
          drawn: false,
          can_draw: true,
          can_collect: false,
          beneficiary_name: null,
        },
      });
    return route.fulfill({ json: [] });
  });
  await page.goto('/');
  await loginPwa(page, 'admin.ndeye');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Campagnes', exact: true }).tap();
  const card = (name: string) => page.locator('.campaign-card-entry').filter({ hasText: name });
  const tontineCard = card('Tontine adhésion'),
    savingsCard = card('Épargne adhésion');
  const pin = tontineCard.getByRole('checkbox');
  await expect(savingsCard).toBeVisible();
  await expect(tontineCard).toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Filtrer les campagnes par type', exact: true })
    .selectOption('TONTINE');
  await expect(savingsCard).toHaveCount(0);
  await page.getByRole('button', { name: 'Voir plus de campagnes', exact: true }).tap();
  await expect(tontineCard).toBeVisible();
  await expect(page.locator('.campaign-card-entry', { hasText: 'Tontine archivée' })).toHaveCount(
    0,
  );
  await expect(pin).toBeEnabled();
  await pin.check();
  await expect(pin).toBeChecked();
  await page
    .getByRole('combobox', { name: 'Filtrer les campagnes par type', exact: true })
    .selectOption('');
  await savingsCard.getByRole('checkbox').tap();
  await expect(savingsCard).toHaveCount(0);
  await nav.getByRole('button', { name: 'Accueil', exact: true }).tap();
  await expect(
    page.getByLabel('Choisir la campagne Tontine adhésion', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Choisir la campagne Épargne adhésion', { exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Plus de campagnes', exact: true }).tap();
  await expect(
    page.getByRole('dialog').getByLabel('Choisir la campagne Épargne adhésion', { exact: true }),
  ).toBeVisible();
  const more = page.getByRole('dialog', { name: 'Autres campagnes en cours', exact: true });
  await more
    .getByRole('checkbox', { name: 'Afficher Épargne adhésion sur l’accueil', exact: true })
    .tap();
  await expect(more.locator('.member-campaign-option')).toHaveCount(0);
  await more.getByRole('button', { name: 'Fermer', exact: true }).tap();
  await expect(page.locator('.wave-actions-grid .overview-campaign-shortcut')).toHaveCount(2);
  await nav.getByRole('button', { name: 'Campagnes', exact: true }).tap();
  await expect(savingsCard.getByRole('checkbox')).toBeChecked();
  await savingsCard.getByRole('checkbox').tap();
  await expect(savingsCard).toHaveCount(0);
  await page.reload();
  await unlockReturning(page);
  await nav.getByRole('button', { name: 'Campagnes', exact: true }).tap();
  await expect(pin).toBeChecked();
  await expect(savingsCard).toHaveCount(0);
  await page.getByRole('button', { name: 'Voir plus de campagnes', exact: true }).tap();
  await expect(savingsCard.getByRole('checkbox')).not.toBeChecked();
  const add = tontineCard.getByRole('button', { name: 'Ajouter un membre', exact: true });
  await expect(add).toBeVisible();
  await expect(tontineCard.locator('details')).not.toHaveAttribute('open', '');
  await add.tap();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un membre à la campagne', exact: true });
  await expect(dialog.getByLabel('Rechercher un membre non inscrit', { exact: true })).toHaveCount(
    0,
  );
  await expect(dialog.getByLabel('Montant à cotiser (FCFA)', { exact: true })).toHaveValue('2000');
  await expect(dialog.getByLabel('Montant à cotiser (FCFA)', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(
    dialog.getByRole('combobox', { name: 'Mode de cotisation', exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'Membre du groupement', exact: true }).fill('awa');
  await expect(dialog).toContainText('Aucun membre non inscrit');
  await dialog.getByRole('combobox', { name: 'Membre du groupement', exact: true }).fill('fatou');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await dialog.getByRole('option', { name: 'Fatou Diatta', exact: false }).tap();
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).tap();
  await expect(dialog).toHaveCount(0);
  expect(saved[0]).toEqual({
    campaignId: tontine,
    body: { membershipId: 'm-fatou', forfait: 2000, isRandom: false },
  });
  await add.tap();
  await dialog.getByRole('combobox', { name: 'Membre du groupement', exact: true }).click();
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await expect(dialog.getByRole('option')).not.toContainText('Fatou');
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).first().tap();
  await expect(dialog).toHaveCount(0);
  const addSavings = savingsCard.getByRole('button', { name: 'Ajouter un membre', exact: true });
  await addSavings.tap();
  await dialog
    .getByRole('combobox', { name: 'Mode de cotisation', exact: true })
    .selectOption('free');
  await expect(dialog.getByLabel('Montant à cotiser (FCFA)', { exact: true })).toHaveCount(0);
  await expect(dialog).toContainText('Montant libre');
  await dialog.getByRole('combobox', { name: 'Membre du groupement', exact: true }).fill('awa');
  await dialog.getByRole('option', { name: 'Awa Fall', exact: true }).tap();
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).tap();
  await expect(dialog).toHaveCount(0);
  expect(saved[1]).toEqual({
    campaignId: savings,
    body: { membershipId: 'm-awa', forfait: null, isRandom: true },
  });
  await addSavings.tap();
  await expect(dialog.getByLabel('Montant à cotiser (FCFA)', { exact: true })).toHaveValue('1500');
  await expect(dialog.getByLabel('Montant à cotiser (FCFA)', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await dialog.getByRole('combobox', { name: 'Membre du groupement', exact: true }).fill('bintou');
  await expect(dialog.getByRole('option', { name: 'Bintou Ndiaye', exact: true })).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Membre du groupement', exact: true }).press('Enter');
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).tap();
  await expect(dialog).toHaveCount(0);
  expect(saved[2]).toEqual({
    campaignId: savings,
    body: { membershipId: 'm-bintou', forfait: 1500, isRandom: false },
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('campagnes-adhesions.png') });
});
