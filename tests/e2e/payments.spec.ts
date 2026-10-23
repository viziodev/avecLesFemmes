import { test, expect, type Page } from '../mobile/fixtures';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
const pwa = process.env.PWA_URL || 'http://localhost:8086';
const password = process.env.DEMO_PASSWORD!;
const headers = {
  'X-Requested-With': 'AvecLesFemmes',
  'X-Confirm-Password': 'utf8:' + Buffer.from(password).toString('base64'),
};
let groupId: string, campaignId: string, participationId: string;
const campaignName = 'Recette épargne ' + Date.now();
const today = new Date().toISOString().slice(0, 10);
const base = () => `${pwa}/api/v1/groupements/${groupId}/campaigns/${campaignId}`;
test.beforeAll(async ({ request }) => {
  if (
    !['localhost', '127.0.0.1'].includes(new URL(pwa).hostname) ||
    !password ||
    password.length < 12
  )
    throw new Error(
      'Ces tests modifient uniquement la base locale de qualification avec les comptes de démonstration.',
    );
  expect(
    (
      await request.post(pwa + '/api/v1/auth/login', {
        headers,
        data: { login: 'admin.ndeye', password },
      })
    ).ok(),
  ).toBeTruthy();
  const groups = await (await request.get(pwa + '/api/v1/groupements')).json();
  groupId = groups.items.find((g: any) => g.name === 'Les Femmes de Grand Yoff').id;
  const types = await (await request.get(pwa + '/api/v1/campaign-types')).json();
  const created = await request.post(`${pwa}/api/v1/groupements/${groupId}/campaigns`, {
    headers,
    data: {
      name: campaignName,
      typeId: types.find((t: any) => t.code === 'AVEC').id,
      startDate: today,
      endDate: String(Number(today.slice(0, 4)) + 1) + today.slice(4),
      weekday: new Date(today).getUTCDay(),
      intervalWeeks: 1,
      standardAmount: 2000,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  campaignId = (await created.json()).id;
  const members = await (
    await request.get(`${pwa}/api/v1/groupements/${groupId}/members?limit=100`)
  ).json();
  for (const name of ['Ndèye Diop', 'Awa Fall']) {
    const member = members.items.find((m: any) => m.name === name);
    const res = await request.post(base() + '/participants', {
      headers,
      data: {
        membershipId: member.id,
        forfait: name === 'Ndèye Diop' ? 2000 : null,
        isRandom: name === 'Awa Fall',
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    if (name === 'Ndèye Diop') participationId = (await res.json()).id;
  }
  expect((await request.post(base() + '/savings-session', { headers })).status()).toBe(201);
});
async function login(page: Page, user = 'admin.ndeye') {
  await page.goto(pwa);
  await page.getByLabel('Identifiant', { exact: true }).fill(user);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  const choice = page.getByRole('button', {
    name: `Choisir la campagne ${campaignName}`,
    exact: true,
  });
  await expect(choice).toBeVisible();
  await choice.click();
}
async function fillPayment(page: Page) {
  await page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }).click();
  const selection = page.getByRole('combobox', { name: 'Participante', exact: true });
  const id = await selection.locator('option', { hasText: 'Ndèye' }).getAttribute('value');
  await selection.selectOption(id!);
  await expect(page.getByLabel('Montant réellement versé en FCFA')).toHaveValue('2000');
  await expect(page.getByLabel('Date du versement', { exact: true })).toHaveValue(today);
}
test('encaissement : vérification, confirmation et reçu acquitté par le serveur', async ({
  page,
}) => {
  await login(page);
  await fillPayment(page);
  await page.getByRole('button', { name: 'Vérifier la cotisation', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Récapitulatif de la cotisation' })).toContainText(
    'Ndèye',
  );
  await page.getByRole('button', { name: 'Confirmer la cotisation', exact: true }).click();
  const receipt = page.getByRole('dialog', { name: 'Encaissement confirmé', exact: true });
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText(/2.?000 FCFA/);
  await expect(receipt).toContainText('Référence');
  await receipt.getByRole('button', { name: 'Fermer', exact: true }).last().click();
});
test('un refus serveur conserve la saisie et ne produit pas de reçu', async ({ page }) => {
  await login(page);
  await fillPayment(page);
  await page.route('**/contributions', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 409, json: { message: 'Séance verrouillée pour le test' } })
      : r.continue(),
  );
  await page.getByRole('button', { name: 'Vérifier la cotisation', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la cotisation', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Séance verrouillée' })).toBeVisible();
  await expect(page.getByLabel('Montant réellement versé en FCFA')).toHaveValue('2000');
  await expect(page.getByRole('dialog', { name: 'Encaissement confirmé' })).toHaveCount(0);
});
test('trois envois simultanés avec la même clé ne produisent qu’un encaissement', async ({
  page,
}) => {
  await login(page);
  const before = await (await page.request.get(base() + '/dashboard')).json();
  const data = { participationId, amount: 2000, paidOn: today, idempotencyKey: randomUUID() };
  const responses = await Promise.all(
    [1, 2, 3].map(() => page.request.post(base() + '/contributions', { headers, data })),
  );
  for (const response of responses) expect(response.status(), await response.text()).toBe(201);
  expect(new Set(await Promise.all(responses.map(async (r) => (await r.json()).id))).size).toBe(1);
  const after = await (await page.request.get(base() + '/dashboard')).json();
  expect(BigInt(after.total) - BigInt(before.total)).toBe(2000n);
});
test('membre : versement libre unique dans la séance du jour et total personnel', async ({
  page,
}) => {
  await login(page, 'membre.awa');
  await page.getByRole('button', { name: 'Faire un versement', exact: true }).click();
  await page.getByLabel('Montant à verser (FCFA)', { exact: true }).fill('2500');
  await page.getByRole('button', { name: 'Vérifier mon versement', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
  const receipt = page.getByRole('dialog', { name: 'Versement confirmé', exact: true });
  await expect(receipt).toContainText(/2.?500 FCFA/);
  await receipt.getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await expect(
    page.getByRole('button', { name: 'Faire un versement', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Montant collecté pour cette épargne' }),
  ).toContainText(/2.?500 FCFA/);
});
test('responsable : navigation membre, QR personnel et manifest installable', async ({ page }) => {
  await login(page);
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Plus', exact: true })
    .click();
  await page.getByRole('button', { name: 'Mon épargne personnelle', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Identité du groupement et du membre', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Présenter mon QR', exact: true }).click();
  await expect(page.locator('.qr-box svg')).toBeVisible();
  const manifest = await (await page.request.get(pwa + '/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
});
test('responsable : formulaire mensuel unifié, montant commun et jour dans le mois', async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: 'Campagnes', exact: true })
    .click();
  await page.getByRole('button', { name: 'Créer une campagne', exact: true }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByLabel('Montant standard / forfait (FCFA)', { exact: true })).toBeVisible();
  await form
    .getByRole('combobox', { name: 'Fréquence de cotisation', exact: true })
    .selectOption('MONTHLY');
  await form.getByRole('combobox', { name: 'Jour de rencontre', exact: true }).selectOption('0');
  await form
    .getByRole('combobox', { name: 'Rencontre dans le mois', exact: true })
    .selectOption('1');
  await expect(form.getByLabel('Intervalle en semaines', { exact: true })).toHaveCount(0);
  await expect(form.getByLabel('Date de début', { exact: true })).toBeVisible();
  await expect(form.getByLabel('Date de fin', { exact: true })).toBeVisible();
});

// Les autres suites retrouvent uniquement les campagnes actives de leur propre jeu.
test.afterAll(async ({ request }) => {
  if (!campaignId) return;
  expect(
    (
      await request.post(pwa + '/api/v1/auth/login', {
        headers,
        data: { login: 'superadmin', password },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (await request.patch(base() + '/activation', { headers, data: { active: false } })).ok(),
  ).toBeTruthy();
});
