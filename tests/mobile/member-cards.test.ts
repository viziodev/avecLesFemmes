import { test, expect } from './fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
test.use({ serviceWorkers: 'block' });

test('membres : cartes trois lignes, inscriptions et montants épargne', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const members = [
    {
      id: 'member-ndeye',
      name: 'Ndèye Diop',
      phone: '+221770000002',
      role: 'ADMIN',
      active: true,
      is_blocked: false,
      gender: 'F',
      address: 'Grand Yoff',
      function_name: 'Présidente',
      campaigns: [
        {
          campaign_id: 'avec-1',
          name: 'Épargne solidaire',
          type_name: 'Avec Épargne',
          type_code: 'AVEC',
          is_savings: true,
          active: true,
          paid_amount: '123500',
        },
        {
          campaign_id: 'tontine-1',
          name: 'Tontine des femmes',
          type_name: 'Tontine rotative',
          type_code: 'TONTINE',
          is_savings: false,
          active: true,
          paid_amount: '9000',
        },
        {
          campaign_id: 'avec-old',
          name: 'Épargne clôturée',
          type_name: 'Avec Épargne',
          type_code: 'AVEC',
          is_savings: true,
          active: false,
          paid_amount: '700',
        },
      ],
    },
    {
      id: 'member-mariama',
      name: 'Mariama Bâ',
      phone: null,
      role: 'MEMBER',
      active: true,
      is_blocked: false,
      gender: 'F',
      campaigns: [],
    },
  ];
  await page.route('**/members?*', (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') || '';
    const norm = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const items = members.filter(
      (m) => norm(m.name).includes(norm(q)) || (m.phone || '').includes(q),
    );
    return route.fulfill({ json: { items, total: items.length } });
  });
  await page.goto('/');
  await page.getByLabel('Identifiant', { exact: true }).fill('admin.ndeye');
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.DEMO_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Membres', exact: true })
    .tap();
  const cards = page.locator('.member-list-card');
  await expect(cards).toHaveCount(2);
  for (const card of await cards.all()) {
    const rows = card.locator('summary .compact-session-body > .compact-card-line');
    await expect(rows).toHaveCount(3);
    expect(
      Math.max(
        ...(await rows.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().height))),
      ),
    ).toBeLessThanOrEqual(24);
  }
  const ndeye = cards.filter({ hasText: 'Ndèye Diop' });
  await expect(ndeye.locator('summary')).toContainText('Épargne solidaire');
  await expect(ndeye.locator('summary')).toContainText(/123.?500 F/);
  await expect(ndeye.locator('summary')).toContainText('Tontine des femmes');
  await ndeye.locator('summary').tap();
  const registrations = ndeye.getByRole('region', { name: 'Campagnes de Ndèye Diop', exact: true });
  await expect(registrations.locator('li')).toHaveCount(3);
  await expect(registrations.locator('li', { hasText: 'Épargne solidaire' })).toContainText(
    /Versé : 123.?500 FCFA/,
  );
  await expect(registrations.locator('li', { hasText: 'Épargne clôturée' })).toContainText(
    'Archivée',
  );
  await expect(
    registrations.locator('li', { hasText: 'Tontine des femmes' }).getByText(/Versé/),
  ).toHaveCount(0);
  await ndeye.getByRole('button', { name: 'Afficher le QR de Ndèye Diop', exact: true }).tap();
  await expect(page.getByRole('dialog')).toContainText('Carte Membre · Ndèye Diop');
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).first().tap();
  await expect(
    ndeye.getByRole('button', { name: 'Révoquer le code secret de Ndèye Diop', exact: true }),
  ).toHaveCount(0);
  await expect(ndeye.getByRole('button', { name: 'Bloquer', exact: true })).toBeVisible();
  await cards.filter({ hasText: 'Mariama Bâ' }).locator('summary').tap();
  await expect(cards.filter({ hasText: 'Mariama Bâ' })).toContainText('Aucune campagne');
  await page
    .getByLabel('Rechercher une membre par nom ou téléphone', { exact: true })
    .fill('ndeye');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('Ndèye Diop');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('membres-campagnes.png') });
});
