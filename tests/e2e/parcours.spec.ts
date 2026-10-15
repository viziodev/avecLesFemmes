import { test, expect, type Page } from '@playwright/test';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
config({ path: '.env', quiet: true });
const password = process.env.DEMO_PASSWORD!;
const pwa = process.env.PWA_URL || 'http://localhost:8086';
async function login(page: Page, url: string, user: string) {
  await page.goto(url);
  const logoutBtn = page.getByRole('button', { name: 'Se déconnecter', exact: true });
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Identifiant', exact: true }).click();
  await page.getByLabel('Identifiant', { exact: true }).fill(user);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  await page.locator('#group-select').selectOption({ label: 'Les Femmes de Grand Yoff' });
}
test('super administrateur consulte, crée et active une campagne', async ({ page }) => {
  await login(page, './', 'superadmin');
  await expect(page.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(page.getByText('Épargne solidaire 2026', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Désactiver', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Activer', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Activer', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Désactiver', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Masquer', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/super-admin.png', fullPage: true });
  await page.getByRole('button', { name: 'Créer un groupement', exact: true }).click();
  await page.getByLabel('Nom du groupement').fill('Pilote navigateur ' + Date.now());
  await page.getByLabel('Adresse', { exact: true }).fill('Dakar');
  await expect(page.getByLabel('Responsable', { exact: true })).toHaveCount(0);
  await page.getByLabel('Téléphone', { exact: true }).fill('+221771234567');
  await expect(page.getByText('Types de campagne autorisés', { exact: false })).toBeVisible();
  await expect(page.getByText('Événements applicables', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/creer-groupement-modal.png' });
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Groupement créé');
});
test('administratrice enregistre et retrouve sa vue membre', async ({ page }) => {
  await login(page, pwa, 'admin.ndeye');
  const campSelect = page.getByLabel('Campagne suivie', { exact: true });
  if (await campSelect.isVisible()) {
    const options = await campSelect.locator('option').allTextContents();
    const epargneOption = options.find((t) => t.includes('Épargne solidaire 2026'));
    if (epargneOption) {
      await campSelect.selectOption({ label: epargneOption });
    }
  }
  await page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }).click();
  const selection = page.getByRole('combobox', { name: 'Participante', exact: true });
  // Les deux participantes du seed sont affichées dans l’ordre Awa puis Ndèye.
  await selection.selectOption({ index: 1 });
  await page.getByLabel('Montant réellement versé en FCFA').fill('2000');
  await page.getByLabel('Date du versement').fill('2026-06-02');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Cotisation enregistrée');
  await page.getByRole('button', { name: 'Mon épargne personnelle', exact: true }).click();
  await expect(page.getByText('Mon montant versé', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Masquer', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/admin-personal.png', fullPage: true });
});
test('membre sur téléphone et manifest PWA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, pwa, 'membre.awa');
  await expect(page.getByText('Mon montant versé', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Créer un groupement' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/member-mobile.png', fullPage: true });
  const manifest = await page.request.get(pwa + '/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe('standalone');
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ma participation', exact: true })).toBeVisible();
});
test('connexion par code téléphone et déconnexion', async ({ page }) => {
  await login(page, './', 'superadmin');
  const groups = await (await page.request.get('/api/v1/groupements')).json();
  const groupId = groups.items.find(
    (g: { name: string }) => g.name === 'Les Femmes de Grand Yoff',
  ).id;
  const phone = '+2217' + Date.now().toString().slice(-8);
  const created = await page.request.post(`/api/v1/groupements/${groupId}/members`, {
    headers: { 'X-Requested-With': 'AvecLesFemmes' },
    data: { name: 'Membre test OTP', login: 'otp.' + randomUUID().slice(0, 8), phone },
  });
  expect(created.status()).toBe(201);
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await page.goto(pwa);
  await page.getByRole('button', { name: 'Code SMS', exact: true }).click();
  await page.getByLabel('Téléphone avec indicatif', { exact: true }).fill(phone);
  await page.getByRole('button', { name: 'Recevoir un code', exact: true }).click();
  const text = await page.locator('.local-code').innerText();
  const code = text.match(/\d{6}/)?.[0];
  expect(code).toBeTruthy();
  await page.getByLabel('Code reçu par SMS').fill(code!);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});
test('un double envoi concurrent produit un seul versement', async ({ page }) => {
  await login(page, pwa, 'admin.ndeye');
  const groups = await (await page.request.get(pwa + '/api/v1/groupements')).json();
  const targetGroup =
    groups.items.find((g: any) => g.name === 'Les Femmes de Grand Yoff') || groups.items[0];
  const groupId = targetGroup.id;
  const campaigns = await (
    await page.request.get(pwa + `/api/v1/groupements/${groupId}/campaigns`)
  ).json();
  const targetCampaign =
    campaigns.items.find((c: any) => c.name === 'Épargne solidaire 2026') || campaigns.items[0];
  const campaignId = targetCampaign.id;
  const base = pwa + `/api/v1/groupements/${groupId}/campaigns/${campaignId}`;
  const participants = await (await page.request.get(base + '/participants')).json();
  const before = await (await page.request.get(base + '/dashboard')).json();
  const body = {
    participationId: participants.items[0].id,
    amount: 100,
    paidOn: '2026-06-02',
    idempotencyKey: randomUUID(),
  };
  const responses = await Promise.all(
    [1, 2, 3].map(() =>
      page.request.post(base + '/contributions', {
        headers: { 'X-Requested-With': 'AvecLesFemmes' },
        data: body,
      }),
    ),
  );
  for (const r of responses) expect(r.status()).toBe(201);
  const records = await Promise.all(responses.map((r) => r.json()));
  expect(new Set(records.map((r) => r.id)).size).toBe(1);
  const after = await (await page.request.get(base + '/dashboard')).json();
  expect(BigInt(after.total) - BigInt(before.total)).toBe(100n);
});
test('membre se connecte par code PIN et affiche son QR code vectoriel', async ({ page }) => {
  await login(page, './', 'superadmin');
  const groups = await (await page.request.get('/api/v1/groupements')).json();
  const groupId = groups.items[0].id;
  const phone = '+2217' + Date.now().toString().slice(-8);
  const pin = '5678';
  const created = await page.request.post(`/api/v1/groupements/${groupId}/members`, {
    headers: { 'X-Requested-With': 'AvecLesFemmes' },
    data: {
      name: 'Fatou Ndiaye Test PIN',
      login: 'pin.' + randomUUID().slice(0, 8),
      phone,
      pin,
      gender: 'F',
      address: 'Medina Rue 6',
    },
  });
  expect(created.status()).toBe(201);
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();

  await page.goto(pwa);
  await page.getByLabel('Téléphone avec indicatif', { exact: true }).fill(phone);
  await page.getByLabel('Code secret (4 chiffres)', { exact: true }).fill(pin);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();

  // Test affichage de la carte QR vectorielle
  await page.getByRole('button', { name: 'Mon Code QR' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.qr-box svg')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});

test('super administrateur gère le CRUD complet des événements et des types de campagne', async ({
  page,
}) => {
  await login(page, './', 'superadmin');
  await page.getByRole('button', { name: 'Types & Événements', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Catalogue des événements', exact: true }),
  ).toBeVisible();

  // 1. Création d'un événement
  const eventCode = 'EVT_' + Date.now().toString().slice(-6);
  await page.getByRole('button', { name: 'Créer un événement' }).first().click();
  await page.getByLabel('Nom de l’événement', { exact: true }).fill('Événement E2E Test');
  await page.getByLabel('Code unique en majuscules', { exact: true }).fill(eventCode);
  await page.getByLabel('Description', { exact: true }).fill('Description test automatisé');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Événement ajouté au catalogue.');
  const eventRow = page.locator('tr', { hasText: eventCode });
  await expect(eventRow).toBeVisible();

  // 2. Modification de l'événement
  await eventRow.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Nom de l’événement', { exact: true }).fill('Événement E2E Modifié');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Événement mis à jour.');
  await expect(eventRow).toContainText('Événement E2E Modifié');

  // 3. Suppression de l'événement
  page.once('dialog', (dialog) => dialog.accept());
  await eventRow.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Événement supprimé.');
  await expect(page.locator('tr', { hasText: eventCode })).toHaveCount(0);

  // 4. Création d'un type de campagne
  const typeCode = 'TYP_' + Date.now().toString().slice(-6);
  await page.getByRole('button', { name: 'Créer un type de campagne' }).first().click();
  await page.getByLabel('Nom du type', { exact: true }).fill('Type E2E Test');
  await page.getByLabel('Code unique en majuscules', { exact: true }).fill(typeCode);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Type de campagne créé.');
  const typeRow = page.locator('tr', { hasText: typeCode });
  await expect(typeRow).toBeVisible();

  // 5. Modification du type
  await typeRow.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Nom du type', { exact: true }).fill('Type E2E Modifié');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Type de campagne mis à jour.');
  await expect(typeRow).toContainText('Type E2E Modifié');

  // 6. Suppression du type
  page.once('dialog', (dialog) => dialog.accept());
  await typeRow.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Type de campagne supprimé.');
  await expect(page.locator('tr', { hasText: typeCode })).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});

test('recherche autocomplete groupement et affichage des détails (nom, adresse, téléphone, code QR)', async ({
  page,
}) => {
  await login(page, './', 'superadmin');

  // Recherche par autocomplétion
  const searchInput = page.locator('#group-search-input');
  await searchInput.fill('Grand Yoff');
  await expect(page.locator('.group-autocomplete-dropdown')).toBeVisible();
  await page.locator('.group-autocomplete-item', { hasText: 'Les Femmes de Grand Yoff' }).click();

  // Vérification de la carte détaillée du groupement
  const detailsCard = page.locator('.group-details-card');
  await expect(detailsCard).toBeVisible();
  await expect(detailsCard.locator('.group-details-name')).toHaveText('Les Femmes de Grand Yoff');
  await expect(detailsCard.getByText('Grand Yoff, Dakar')).toBeVisible();
  await expect(detailsCard.getByText('+221770000002')).toBeVisible();

  // Ouverture du QR code du groupement
  await detailsCard.getByRole('button', { name: 'Code QR du Groupement' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.qr-box svg')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});

test('bouton Créer une campagne sur l’onglet Campagnes à la sélection d’un groupement', async ({
  page,
}) => {
  await login(page, './', 'superadmin');
  await page.locator('#group-select').selectOption({ label: 'Les Femmes de Grand Yoff' });
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();

  const createButton = page
    .getByRole('button', { name: 'Créer une campagne', exact: true })
    .first();
  await expect(createButton).toBeVisible();
  await createButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Créer une campagne' })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});
