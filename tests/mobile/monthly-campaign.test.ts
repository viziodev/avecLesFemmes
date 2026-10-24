import { test, expect } from './fixtures';
import { mockSpace, unlockMockSpace } from './pwa-space';
test.use({ serviceWorkers: 'block', autoConfirmSensitive: false });

test('campagne mensuelle : premier dimanche, épargne et tontine sans événement', async ({
  page,
}) => {
  await mockSpace(page, true);
  const savings = '11111111-1111-4111-a111-111111111111',
    tontine = '22222222-2222-4222-a222-222222222222';
  await page.route('**/campaign-types', (r) =>
    r.fulfill({
      json: [
        { id: savings, name: 'Avec Épargne', code: 'AVEC' },
        { id: tontine, name: 'Tontine rotative', code: 'TONTINE' },
      ],
    }),
  );
  const saved: any[] = [];
  await page.route('**/groupements/group/campaigns', (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    const body = r.request().postDataJSON();
    saved.push(body);
    return r.fulfill({ status: 201, json: { id: 'new-' + saved.length, ...body } });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Campagnes', exact: true })
    .click();
  for (const [index, name, type, amount] of [
    [0, 'Sokorou Kor', savings, 3000],
    [1, 'Natte-10000', tontine, 1000],
  ] as const) {
    await page.getByRole('button', { name: 'Créer une campagne', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('combobox', { name: 'Type de campagne', exact: true })
      .selectOption(type);
    await dialog.getByLabel('Nom de la campagne', { exact: true }).fill(name);
    await dialog.getByLabel('Date de début', { exact: true }).fill('2026-11-01');
    await dialog.getByLabel('Date de fin', { exact: true }).fill('2027-08-31');
    await dialog
      .getByLabel('Montant standard / forfait (FCFA)', { exact: true })
      .fill(String(amount));
    await dialog
      .getByRole('combobox', { name: 'Fréquence de cotisation', exact: true })
      .selectOption('MONTHLY');
    await dialog
      .getByRole('combobox', { name: 'Jour de rencontre', exact: true })
      .selectOption('0');
    await dialog
      .getByRole('combobox', { name: 'Rencontre dans le mois', exact: true })
      .selectOption('1');
    await expect(dialog.getByLabel('Intervalle en semaines', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await page
      .getByLabel('Mot de passe de confirmation', { exact: true })
      .fill(process.env.DEMO_PASSWORD || 'Test-password-only');
    await page.getByRole('button', { name: 'Confirmer l’opération', exact: true }).click();
    await expect.poll(() => saved.length).toBe(index + 1);
    expect(saved[index]).toMatchObject({
      name,
      typeId: type,
      standardAmount: amount,
      weekday: 0,
      rotationInterval: 'MONTHLY',
      monthlyWeek: 1,
      startDate: '2026-11-01',
      endDate: '2027-08-31',
    });
    expect(saved[index].eventId).toBeUndefined();
    await expect(dialog).toHaveCount(0);
  }
});
